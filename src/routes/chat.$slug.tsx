import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Send, ArrowRight, UserCircle2, Paperclip, X, Loader2,
  MapPin, Radio, ShoppingBag, ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getStorefront, type StorefrontProduct } from "@/lib/storefront.functions";
import { getChatConfig } from "@/lib/chat-config.functions";
import { uploadChatImage } from "@/lib/chat-upload.functions";
import {
  LIVE_LOCATION_DURATION_MS,
  formatLocationSummary,
  isLiveLocationActive,
  mapsUrl,
  type LocationAttachment,
} from "@/lib/chat-location";
import {
  CustomerLoginPanel,
  useCustomerSession,
} from "@/components/customer/customer-login";


export const Route = createFileRoute("/chat/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "new" ? "new" : "continue") as "new" | "continue",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `محادثة — ${params.slug}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

type ChatAttachment = {
  kind?: string;
  url: string;
  mime?: string | null;
  name?: string | null;
  source?: string | null;
  lat?: number;
  lng?: number;
  accuracy?: number | null;
  label?: string | null;
  live?: boolean;
  updated_at?: string | null;
  expires_at?: string | null;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at?: string;
  attachments?: ChatAttachment[] | null;
};

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? "تم رفض إذن الوصول للموقع. فعّله من إعدادات المتصفح."
            : "تعذر تحديد موقعك الآن، حاول مرة أخرى.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}


const VISITOR_KEY = (slug: string) => `cupai_visitor_${slug}`;

function readVisitorId(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(VISITOR_KEY(slug)); } catch { return null; }
}
function writeVisitorId(slug: string, id: string) {
  try { window.localStorage.setItem(VISITOR_KEY(slug), id); } catch {}
}

/** Fetch a persistent visitor id from the server (httpOnly cookie backed). */
async function fetchServerVisitorId(slug: string): Promise<string | null> {
  try {
    const local = readVisitorId(slug);
    const url = local ? `/api/visitor?fallback=${encodeURIComponent(local)}` : "/api/visitor";
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { visitor_id?: string };
    return j.visitor_id ?? null;
  } catch {
    return null;
  }
}

function useResolvedVisitorId(slug: string) {
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const localVid = readVisitorId(slug);
      let vid = await fetchServerVisitorId(slug);
      if (!vid) vid = localVid;
      if (cancelled) return;
      if (vid) writeVisitorId(slug, vid);
      setVisitorId(vid);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return visitorId;
}

function ChatPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch() as { mode?: "new" | "continue" };
  const mode: "new" | "continue" = search.mode === "new" ? "new" : "continue";

  const storefront = useQuery({
    queryKey: ["storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
  });
  const config = useQuery({
    queryKey: ["chat-config"],
    queryFn: () => getChatConfig(),
    staleTime: Infinity,
  });

  const merchantId = storefront.data?.merchantId ?? null;
  const brandName = storefront.data?.brandName || slug;

  const visitorId = useResolvedVisitorId(slug);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Tracked internally only — never surfaced to the customer in any way.
  const [, setNeedsHuman] = useState(false);
  const [input, setInput] = useState("");
  const [productsOpen, setProductsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---- Live location sharing -------------------------------------------
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

  const [initErr, setInitErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chatAiUrl = config.data?.chatAiUrl ?? null;
  const anonKey = config.data?.supabaseAnonKey ?? null;

  const session = useCustomerSession();
  const loggedIn = !!session.data?.loggedIn;
  const customerEmail = session.data?.email ?? null;

  const callEdge = useMemo(() => {
    if (!chatAiUrl || !anonKey) return null;
    return async (body: Record<string, unknown>) => {
      const res = await fetch(chatAiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return json as {
        conversation_id: string | null;
        needs_human?: boolean;
        messages?: ChatMessage[];
        reply?: string | null;
      };
    };
  }, [chatAiUrl, anonKey]);

  // Initialize conversation. `mode=new` opens a NEW conversation for the
  // SAME visitor — it never rotates the visitor id.
  useEffect(() => {
    if (!callEdge || !merchantId || !loggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        // 1) Resolve a stable visitor id. Prefer the server-issued httpOnly
        //    cookie; fall back to localStorage; server will also stamp a
        //    cookie on the /api/chat-ai response so future calls keep it.
        const vid = visitorId;
        if (cancelled) return;

        const action = mode === "new" ? "start" : "fetch";
        const r = await callEdge({
          action,
          merchant_id: merchantId,
          visitor_id: vid ?? undefined,
        });
        if (cancelled) return;
        setConversationId(r.conversation_id);
        setMessages(r.messages ?? []);
        setNeedsHuman(!!r.needs_human);
      } catch (e: any) {
        if (!cancelled) setInitErr(e?.message || "تعذر بدء المحادثة.");
      }
    })();
    return () => { cancelled = true; };
  }, [callEdge, merchantId, mode, slug, loggedIn, visitorId]);

  // Poll every 4s for new messages (agent replies / handoff updates).
  useEffect(() => {
    if (!callEdge || !conversationId || !loggedIn) return;
    const t = setInterval(async () => {
      try {
        const r = await callEdge({ action: "fetch", conversation_id: conversationId });
        setMessages(r.messages ?? []);
        setNeedsHuman(!!r.needs_human);
      } catch { /* ignore transient errors */ }
    }, 4000);
    return () => clearInterval(t);
  }, [callEdge, conversationId, loggedIn]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function pickFile(file: File | null | undefined) {
    setUploadErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadErr("الصور فقط مسموح بها.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setUploadErr("حجم الصورة يتجاوز 8 ميجابايت.");
      return;
    }
    setPendingFile({ file, preview: URL.createObjectURL(file) });
  }

  function clearPendingFile() {
    setPendingFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send() {
    if (!callEdge || !visitorId || !merchantId) return;
    const text = input.trim();
    const attaching = pendingFile;
    if (!text && !attaching) return;

    setUploadErr(null);
    setInput("");
    setSending(true);

    let attachments: ChatAttachment[] | undefined;
    if (attaching) {
      setUploading(true);
      try {
        const dataUrl = await readFileAsDataUrl(attaching.file);
        const uploaded = await uploadChatImage({
          data: {
            merchantId,
            conversationId: conversationId ?? null,
            fileName: attaching.file.name,
            dataUrl,
          },
        });
        attachments = [uploaded];
      } catch (e: any) {
        setUploadErr(e?.message || "تعذر رفع الصورة.");
        setInput(text);
        setSending(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
      clearPendingFile();
    }

    // Optimistic user bubble
    setMessages((m) => [...m, {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      attachments: attachments ?? null,
    }]);
    try {
      const r = await callEdge({
        action: "send",
        conversation_id: conversationId ?? undefined,
        merchant_id: merchantId,
        visitor_id: visitorId,
        message: text,
        attachments,
      });
      if (r.conversation_id && r.conversation_id !== conversationId) {
        setConversationId(r.conversation_id);
      }
      if (r.messages) setMessages(r.messages);
      setNeedsHuman(!!r.needs_human);
    } catch {
      // Network/agent errors are silent to the customer — no error bubble.
    } finally {
      setSending(false);
    }
  }

  /** Sends one location message (one-shot or the opening point of a live share). */
  const shareLocation = useCallback(
    async (live: boolean) => {
      if (!callEdge || !visitorId || !merchantId) return null;
      setLocErr(null);
      setLocBusy(true);
      try {
        const pos = await getCurrentPosition();
        const now = new Date();
        const attachment: LocationAttachment = {
          kind: "location",
          url: mapsUrl(pos.coords.latitude, pos.coords.longitude),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
          label: null,
          live,
          updated_at: now.toISOString(),
          expires_at: live ? new Date(now.getTime() + LIVE_LOCATION_DURATION_MS).toISOString() : null,
          source: "customer",
        };
        const text = live ? "بدأت مشاركة موقعي الحي معك." : "ده موقعي الحالي.";
        setMessages((m) => [...m, {
          role: "user",
          content: text,
          created_at: now.toISOString(),
          attachments: [attachment as ChatAttachment],
        }]);
        const r = await callEdge({
          action: "send",
          conversation_id: conversationId ?? undefined,
          merchant_id: merchantId,
          visitor_id: visitorId,
          message: text,
          attachments: [attachment],
        });
        if (r.conversation_id && r.conversation_id !== conversationId) {
          setConversationId(r.conversation_id);
        }
        if (r.messages) setMessages(r.messages);
        setNeedsHuman(!!r.needs_human);
        return r.conversation_id ?? conversationId;
      } catch (e: any) {
        setLocErr(e?.message || "تعذر مشاركة الموقع.");
        return null;
      } finally {
        setLocBusy(false);
      }
    },
    [callEdge, conversationId, merchantId, visitorId],
  );



  const disabled = sending || !callEdge || !merchantId || !loggedIn;
  const notFound = storefront.data && !storefront.data.found;
  const products = storefront.data?.products ?? [];

  return (
    <div dir="rtl" className="hub flex min-h-screen flex-col">
      <header className="hub-bar">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {storefront.data?.logoUrl ? (
              <img src={storefront.data.logoUrl} alt={brandName} className="h-10 w-10 shrink-0 rounded-2xl object-cover shadow-card" />
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{brandName}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                متصل الآن
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {loggedIn && (
              <Button asChild variant="ghost" size="icon" className="rounded-full" title="حسابي">
                <Link to="/c/$slug/account" params={{ slug }}>
                  <UserCircle2 className="h-[18px] w-[18px]" />
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="rounded-full" title="العودة للمتجر">
              <Link to="/c/$slug" params={{ slug }}>
                <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="hub-canvas mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-3">
        {notFound && (
          <div className="hub-card p-6 text-center text-sm text-muted-foreground">
            المتجر غير موجود.
          </div>
        )}

        {!notFound && merchantId && !loggedIn && !session.isLoading && (
          <div className="mx-auto w-full max-w-md py-6">
            <CustomerLoginPanel
              merchantId={merchantId}
              visitorId={visitorId}
              brandName={brandName}
              onSuccess={() => session.refetch()}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              يجب تسجيل الدخول لعرض المحادثات والوصول إلى الطلبات.
            </p>
          </div>
        )}

        {initErr && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {initErr}
          </div>
        )}

        {loggedIn && (
        <div className="flex-1 space-y-3 overflow-y-auto py-2">
          {messages.length === 0 && !initErr && (
            <div className="grid place-items-center py-16 text-center">
              <p className="hub-display text-lg">ابدأ المحادثة</p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
                اسأل عن أي منتج أو سعر أو شحن — أو افتح «المنتجات» بالأسفل واختر ما يعجبك.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id ?? i}
              role={m.role}
              content={m.content}
              attachments={m.attachments}
            />
          ))}
          <div ref={bottomRef} />
        </div>
        )}

        {loggedIn && (
        <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-border bg-secondary/60 p-2">
              <img
                src={pendingFile.preview}
                alt="معاينة الصورة المرفقة"
                className="h-14 w-14 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {pendingFile.file.name}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={clearPendingFile}
                disabled={uploading}
                aria-label="إزالة الصورة"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {uploadErr && (
            <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {uploadErr}
            </div>
          )}
          {locErr && (
            <div className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {locErr}
            </div>
          )}
          <div className="hub-scroll-x mb-2 flex items-center gap-2">
            {products.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5 rounded-full"
                onClick={() => setProductsOpen(true)}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                المنتجات
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {products.length}
                </span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 rounded-full border-dashed"
              onClick={() => void shareLocation(false)}
              disabled={disabled || locBusy}
            >
              {locBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              مشاركة موقعي
            </Button>
          </div>
          <div className="flex items-end gap-2 rounded-[1.5rem] border border-border bg-background p-2 shadow-card">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              aria-label="إرفاق صورة"
              title="إرفاق صورة"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب رسالتك..."
              rows={1}
              className="min-h-11 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0"
              disabled={disabled}
            />
            <Button
              onClick={send}
              size="icon"
              disabled={disabled || uploading || (!input.trim() && !pendingFile)}
              className="h-11 w-11 shrink-0 rounded-full"
              aria-label="إرسال"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        )}

      </main>

      {productsOpen && products.length > 0 && (
        <ProductSheet
          products={products}
          onClose={() => setProductsOpen(false)}
          onPick={(name) => {
            setInput((v) => (v ? `${v} ${name}` : name));
            setProductsOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Products picker as a bottom sheet — never covers the conversation. */
function ProductSheet({
  products,
  onPick,
  onClose,
}: {
  products: StorefrontProduct[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim();
    if (!t) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(t.toLowerCase()));
  }, [products, q]);

  return (
    <>
      <div className="hub-sheet-backdrop" onClick={onClose} aria-hidden />
      <div dir="rtl" className="hub-sheet mx-auto w-full max-w-2xl" role="dialog" aria-label="منتجات المتجر">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <span className="mx-auto absolute inset-x-0 top-2 h-1 w-10 rounded-full bg-border" />
          <span className="hub-display flex items-center gap-2 text-sm">
            <ShoppingBag className="h-4 w-4 text-primary" />
            منتجات المتجر
            <span className="hub-chip bg-accent text-accent-foreground">{products.length}</span>
          </span>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose} aria-label="إغلاق">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-4 pb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن منتج…"
            className="h-10 w-full rounded-full border border-border bg-secondary/60 px-4 text-[13px] outline-none focus:border-primary/60"
          />
        </div>
        <div className="grid max-h-[56vh] grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-6 sm:grid-cols-3">
          {list.map((p) => (
            <ProductTile key={p.id} p={p} onPick={onPick} block />
          ))}
          {list.length === 0 && (
            <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
              لا يوجد منتج بهذا الاسم.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function ProductTile({
  p, onPick, block = false,
}: {
  p: StorefrontProduct;
  onPick: (name: string) => void;
  block?: boolean;
}) {
  const img = p.images?.[0];
  return (
    <button
      onClick={() => onPick(p.name)}
      title={`اسأل عن ${p.name}`}
      className={`hub-card overflow-hidden text-start transition-transform active:scale-[0.98] ${
        block ? "w-full" : "w-[132px] shrink-0 snap-start"
      }`}
    >
      <div className="aspect-[4/3] w-full bg-muted">
        {img ? (
          <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted-foreground">
            <ShoppingBag className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="line-clamp-2 text-[11px] font-bold leading-snug">{p.name}</div>
        {p.price != null && (
          <div className="mt-1 text-[11px] font-semibold text-primary">
            {p.price} {p.currency ?? ""}
          </div>
        )}
      </div>
    </button>
  );
}

const BUBBLE_THEME = {
  userBubble:
    "bg-primary text-primary-foreground rounded-br-md shadow-card",
  assistantBubble:
    "bg-card border border-border text-foreground rounded-bl-md shadow-card",
};

function MessageBubble({
  role, content, attachments,
}: {
  role: string;
  content: string;
  attachments?: ChatAttachment[] | null;
}) {
  const isUser = role === "user";
  const theme = BUBBLE_THEME;
  const all = (attachments ?? []).filter((a) => a && typeof a.url === "string");
  const locations = all.filter(
    (a) => a.kind === "location" && typeof a.lat === "number" && typeof a.lng === "number",
  ) as LocationAttachment[];
  const media = all.filter((a) => a.kind !== "location");
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[88%] items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
        <div className={`space-y-2 rounded-2xl px-4 py-2.5 text-[14px] whitespace-pre-wrap leading-[1.8] ${
          isUser ? theme.userBubble : theme.assistantBubble
        }`}>
          {media.length > 0 && (
            <div className={`grid gap-2 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {media.map((a, i) => (
                <a key={a.url + i} href={a.url} target="_blank" rel="noreferrer">
                  <img
                    src={a.url}
                    alt={a.name || "صورة مرفقة"}
                    loading="lazy"
                    className="max-h-56 w-full rounded-xl object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {locations.map((a, i) => {
            const live = isLiveLocationActive(a);
            return (
              <a
                key={`loc-${i}`}
                href={mapsUrl(a.lat, a.lng)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-foreground no-underline"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent">
                  {live ? (
                    <Radio className="h-4 w-4 animate-pulse text-primary" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold">{formatLocationSummary(a)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    فتح في الخرائط
                    {a.accuracy != null ? ` · دقة ±${a.accuracy}م` : ""}
                  </span>
                </span>
              </a>
            );
          })}
          {content && <div>{content}</div>}
        </div>
      </div>
    </div>
  );
}


