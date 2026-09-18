import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, ScrollText, Truck, PhoneCall, Globe, ArrowLeft,
  Bell, CreditCard, AlertTriangle, ShoppingBag, UserRound, Check, HelpCircle,
  MessagesSquare, Clock4, BadgePercent, ChevronDown,
  ShieldAlert, MailCheck, TrendingUp, Bot, Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HubTabBar } from "@/components/hub/hub-shell";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logo from "@/assets/cupai-logo.png.asset.json";
import {
  listNotifications, markNotificationRead, type NotificationRow, type NotificationType,
} from "@/lib/notifications.functions";
import {
  listConversations, setConversationAgent,
  getMerchantAgentSettings, setMerchantAgentGloballyDisabled,
  type ConversationRow,
} from "@/lib/conversations.functions";
import { getEarningsSummary } from "@/lib/orders.functions";




export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم · cupai" },
      { name: "description", content: "أدر منتجاتك، سياساتك، شحنك، وبيانات تواصلك." },
      { property: "og:title", content: "لوحة التحكم · cupai" },
      { property: "og:description", content: "ملخص الطلبات والعملاء والأرباح وإدارة المتجر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

type Tile = {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tone: string;
};

const TILES: Tile[] = [
  { to: "/orders", label: "الطلبات", description: "متابعة وتجهيز", icon: <ShoppingBag className="h-6 w-6" />, tone: "bg-hub-coral-soft text-hub-coral" },
  { to: "/products", label: "المخزون", description: "المنتجات والكميات", icon: <Package className="h-6 w-6" />, tone: "bg-hub-mint-soft text-hub-mint" },
  { to: "/published", label: "الموقع", description: "واجهة متجرك", icon: <Globe className="h-6 w-6" />, tone: "bg-hub-sky-soft text-hub-sky" },
  { to: "/offers", label: "العروض", description: "الخصومات الحالية", icon: <BadgePercent className="h-6 w-6" />, tone: "bg-hub-gold-soft text-hub-gold" },
  { to: "/earnings", label: "الأرباح", description: "ملخص التحصيل", icon: <TrendingUp className="h-6 w-6" />, tone: "bg-hub-mint-soft text-hub-mint" },
  { to: "/shipping", label: "الشحن", description: "المناطق والتكلفة", icon: <Truck className="h-6 w-6" />, tone: "bg-hub-sky-soft text-hub-sky" },
  { to: "/settings/payment-methods", label: "الدفع", description: "طرق استلام المال", icon: <CreditCard className="h-6 w-6" />, tone: "bg-hub-coral-soft text-hub-coral" },
  { to: "/policies", label: "السياسات", description: "شروط متجرك", icon: <ScrollText className="h-6 w-6" />, tone: "bg-hub-gold-soft text-hub-gold" },
  { to: "/contacts", label: "التواصل", description: "بيانات الاتصال", icon: <PhoneCall className="h-6 w-6" />, tone: "bg-hub-sky-soft text-hub-sky" },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(value);
}

function DashboardPage() {
  const convos = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 15000,
  });
  const notifs = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 15000,
  });
  const earnings = useQuery({
    queryKey: ["earnings-summary"],
    queryFn: () => getEarningsSummary(),
    refetchInterval: 30000,
  });

  const activeCount = (convos.data ?? []).filter((c) => {
    const t = new Date(c.last_message_at ?? c.created_at).getTime();
    return c.agent_enabled && Number.isFinite(t) && Date.now() - t <= ACTIVE_NOW_THRESHOLD_MS;
  }).length;
  const unread = (notifs.data ?? []).filter((n) => !n.is_read).length;
  const orderCount = earnings.data?.orderCount ?? 0;
  const pendingProfit = earnings.data?.pendingProfit ?? 0;

  return (
    <div dir="rtl" className="hub min-h-screen pb-24">
      <header className="hub-hero px-5 pb-10 pt-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src={logo.url} alt="cupai" className="h-11 w-11 shrink-0 rounded-2xl" />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold">متجرك</span>
              <span className="hub-latin block truncate text-xs opacity-70">cupai</span>
            </span>
          </Link>
          <a href="#notifications" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-foreground/10" aria-label="فتح الإشعارات">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            )}
          </a>
        </div>
      </header>

      <div className="hub-sheet-top -mt-6 pt-7">
        <div className="mx-auto w-full max-w-3xl space-y-7 px-5 pb-4">
          <section className="space-y-3">
            <h1 className="px-1 text-lg font-bold">نظرة سريعة</h1>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/orders" className="hub-card flex min-h-28 flex-col justify-between p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground">الطلبات</span>
                  <span className="block text-2xl font-bold">{earnings.isLoading ? "—" : orderCount}</span>
                </span>
              </Link>
              <Link to="/missing-info" className="hub-card flex min-h-28 flex-col justify-between p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <MessagesSquare className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs text-muted-foreground">عملاء يتحدث معهم الوكيل</span>
                  <span className="block text-2xl font-bold">{convos.isLoading ? "—" : activeCount}</span>
                </span>
              </Link>
              <Link to="/earnings" className="hub-card col-span-2 flex items-center gap-4 p-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <Clock4 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">أرباح قيد التحصيل</span>
                  <span className="mt-0.5 block text-2xl font-bold">
                    {earnings.isLoading ? "—" : formatMoney(pendingProfit)}
                    {earnings.data?.currency && <small className="me-1 text-xs font-medium text-muted-foreground">{earnings.data.currency}</small>}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">بعد خصم التكاليف المسجلة</span>
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-1 text-sm font-bold">إدارة المتجر</h2>
            <div className="grid grid-cols-3 gap-3">
              {TILES.map((t) => (
                <Link key={t.to} to={t.to as never} className="hub-card flex min-h-28 flex-col items-center justify-center gap-2.5 p-2 text-center transition-transform active:scale-[0.97]">
                  <span className={`grid h-13 w-13 shrink-0 place-items-center rounded-2xl shadow-sm ${t.tone}`}>{t.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold">{t.label}</span>
                    <span className="block text-[9px] text-muted-foreground">{t.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="px-1 text-sm font-bold">روابط مساعدة</h2>
            <Link to="/missing-info" className="hub-card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                <HelpCircle className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">معلومات ناقصة</span>
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <Link to="/settings/notifications" className="hub-card flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                <MailCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold">إشعارات البريد</span>
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </section>

           <BrandAgentSettings />
           <ConversationsSection />
           <NotificationsSection rows={notifs.data ?? []} loading={notifs.isLoading} error={notifs.error} />
        </div>
      </div>

      <HubTabBar />
    </div>
  );
}

function BrandAgentSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["merchant-agent-settings"],
    queryFn: () => getMerchantAgentSettings(),
  });
  const m = useMutation({
    mutationFn: (disabled: boolean) => setMerchantAgentGloballyDisabled({ data: { disabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-agent-settings"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذر التحديث"),
  });
  const disabled = q.data?.agent_globally_disabled ?? false;
  return (
    <section className="space-y-3">
      {disabled && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <div>
            الوكيل الذكي معطّل حالياً على مستوى المتجر بالكامل — لن يتم إرسال أي رد آلي على أي محادثة.
          </div>
        </div>
      )}
      <div className="hub-card overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-hub-mint-soft text-hub-mint"><Bot className="h-6 w-6" /></span>
            <div>
              <div className="text-sm font-bold">تشغيل الوكيل الذكي</div>
              <div className="text-xs text-muted-foreground">لكل محادثات المتجر</div>
            </div>
          </div>
          <Switch checked={!disabled} disabled={q.isLoading || m.isPending} onCheckedChange={(v) => m.mutate(!v)} />
        </div>
        <Link to="/orders" hash="messages" className="flex items-center gap-3 border-t border-border px-4 py-3 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          رسائل حالات الطلبات
          <ArrowLeft className="me-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// Conversations section
// ============================================================================

// Threshold (ms) under which the latest message counts as "active now" and the
// conversation gets the green dot. Change this one constant to tune sensitivity.
const ACTIVE_NOW_THRESHOLD_MS = 5 * 60 * 1000;

function ConversationsSection() {
  const q = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 15000,
  });

  const filtered: ConversationRow[] = q.data ?? [];

  const now = Date.now();

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <MessagesSquare className="h-4 w-4" />
          المحادثات
        </h2>
        <span className="text-xs text-muted-foreground">
          {q.isLoading ? "جارٍ التحميل…" : `${filtered.length} محادثة`}
        </span>
      </div>

      {q.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(q.error as Error)?.message || "تعذر تحميل المحادثات."}
        </div>
      )}

      {!q.isLoading && filtered.length === 0 && !q.isError && (
        <div className="rounded-2xl border border-border/60 bg-background/80 p-8 text-center text-sm text-muted-foreground shadow-card backdrop-blur">
          لا توجد محادثات لعرضها.
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((c) => (
          <ConversationListItem key={c.id} c={c} now={now} />
        ))}
      </ul>
    </section>
  );
}

function ConversationListItem({ c, now }: { c: ConversationRow; now: number }) {
  const qc = useQueryClient();
  const lastIso = c.last_message_at ?? c.created_at;
  const lastMs = new Date(lastIso).getTime();
  const isActive =
    Number.isFinite(lastMs) && now - lastMs <= ACTIVE_NOW_THRESHOLD_MS;

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      setConversationAgent({ data: { id: c.id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
    onError: (e: any) => toast.error(e?.message || "تعذر التحديث"),
  });

  const displayName =
    (c.customer_name && c.customer_name.trim()) ||
    (c.visitor_number ? `زائر #${c.visitor_number}` : "زائر");

  return (
    <li className="rounded-xl border border-border/60 bg-background/70 p-3 backdrop-blur-sm shadow-card">
      <div className="flex items-start gap-3">
        <Link
          to="/conversation/$id"
          params={{ id: c.id }}
          className="flex flex-1 min-w-0 items-start gap-3 rounded-lg -m-1 p-1 hover:bg-muted/40"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{displayName}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30"
                }`}
                title={formatTime(lastIso)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {isActive ? "نشط الآن" : "غير نشط"}
              </span>
              <span className="ms-auto text-[11px] text-muted-foreground">
                {formatTime(lastIso)}
              </span>
            </div>
            {c.last_message_preview && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {c.last_message_preview}
              </p>
            )}
          </div>
        </Link>
        <label
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-2 py-1 text-[11px]"
          title="تشغيل/إيقاف الوكيل الذكي لهذه المحادثة"
          onClick={(e) => e.stopPropagation()}
        >
          <span className={c.agent_enabled ? "text-emerald-600" : "text-muted-foreground"}>
            وكيل
          </span>
          <Switch
            checked={c.agent_enabled}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(!!v)}
          />
        </label>
      </div>
    </li>
  );
}


const NOTIF_META: Record<NotificationType, {
  label: string; Icon: React.ComponentType<{ className?: string }>;
  bg: string; text: string; ring: string;
}> = {
  ai_error: {
    label: "خطأ في الذكاء الاصطناعي",
    Icon: AlertTriangle,
    bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/30",
  },
  new_order: {
    label: "طلب جديد",
    Icon: ShoppingBag,
    bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/30",
  },
  human_needed: {
    label: "يحتاج تدخل بشري",
    Icon: UserRound,
    bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/30",
  },
  missing_information: {
    label: "معلومة ناقصة",
    Icon: HelpCircle,
    bg: "bg-blue-500/10", text: "text-blue-600", ring: "ring-blue-500/30",
  },
  missing_info_followup: {
    label: "تم إبلاغ العملاء المنتظرين",
    Icon: MailCheck,
    bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/30",
  },
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function notificationTarget(row: NotificationRow): { to: "/orders" | "/missing-info" | "/conversation/$id"; params?: { id: string } } {
  if (row.type === "new_order") return { to: "/orders" };
  if (row.type === "missing_information" || row.type === "missing_info_followup") return { to: "/missing-info" };
  return { to: "/conversation/$id", params: { id: row.conversation_id } };
}

function NotificationsSection({ rows, loading, error }: { rows: NotificationRow[]; loading: boolean; error: unknown }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e: any) => toast.error(e?.message || "تعذر التحديث"),
  });

  const unreadCount = rows.filter((r) => !r.is_read).length;

  return (
    <section id="notifications" className="scroll-mt-20">
      <Collapsible open={open} onOpenChange={setOpen} className="hub-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-start rounded-none p-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-hub-coral-soft text-hub-coral"><Bell className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1 text-right">
              <span className="block text-sm font-bold">الإشعارات</span>
              <span className="block text-xs font-normal text-muted-foreground">{loading ? "جارٍ التحميل…" : unreadCount ? `${unreadCount} غير مقروء` : "لا يوجد جديد"}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border p-3">

      {Boolean(error) && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error)?.message || "تعذر تحميل الإشعارات."}
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          لا توجد إشعارات بعد.
        </div>
      )}

      <ul className="space-y-2">
        {rows.slice(0, 8).map((n) => {
          const meta = NOTIF_META[n.type] ?? NOTIF_META.ai_error;
          const Icon = meta.Icon;
          return (
            <li key={n.id} className={`flex items-start gap-2 rounded-xl border p-3 ${
                n.is_read ? "border-border/60 bg-background/70" : "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
              }`}
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-2 ${meta.bg} ${meta.text} ${meta.ring}`}>
                <Icon className="h-4 w-4" />
              </div>
               <Link {...notificationTarget(n)} className="min-w-0 flex-1" onClick={() => !n.is_read && markRead.mutate(n.id)}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
                  {!n.is_read && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      جديد
                    </span>
                  )}
                  <span className="ms-auto text-[11px] text-muted-foreground">{formatTime(n.created_at)}</span>
                </div>
                {n.message && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {n.message}
                  </p>
                )}
               </Link>
              {!n.is_read && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 shrink-0"
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  تحديد كمقروء
                </Button>
              )}
            </li>
          );
        })}
      </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
