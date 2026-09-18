import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Package, Clock, CircleCheck } from "lucide-react";

import { HubShell, HubCard } from "@/components/hub/hub-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getEarningsSummary, type EarningsSummary } from "@/lib/orders.functions";

export const Route = createFileRoute("/earnings")({
  head: () => ({
    meta: [
      { title: "الأرباح · cupai" },
      { name: "description", content: "نظرة مالية سريعة على أداء متجرك." },
      { property: "og:title", content: "الأرباح · cupai" },
      { property: "og:description", content: "نظرة مالية سريعة على أداء متجرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "الأرباح · cupai" },
      { name: "twitter:description", content: "نظرة مالية سريعة على أداء متجرك." },
    ],
  }),
  component: EarningsPage,
});

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

function EarningsPage() {
  const q = useQuery({
    queryKey: ["earnings-summary"],
    queryFn: () => getEarningsSummary(),
    refetchInterval: 30_000,
  });

  const data: EarningsSummary | undefined = q.data;

  return (
    <HubShell
      eyebrow="الأرباح"
      title={<>ملخص الأرباح</>}
      subtitle="المبالغ المحصلة والقيد التحصيل بعد خصم تكلفة الشحن المسجلة."
    >
      {q.isLoading ? (
        <LoadingMetrics />
      ) : q.isError ? (
        <HubCard className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold">تعذر تحميل البيانات</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            {(q.error as Error)?.message || "حدث خطأ أثناء جلب نظرتك المالية."}
          </p>
        </HubCard>
      ) : !data || data.orderCount === 0 ? (
        <HubCard className="p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold">لا توجد أرباح بعد</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            بمجرد استلام أول طلب، ستظهر هنا نظرتك المالية السريعة.
          </p>
        </HubCard>
      ) : (
        <div className="space-y-3">
          <MetricRow icon={<CircleCheck className="h-5 w-5" />} label="أرباح تم تحصيلها" value={fmtMoney(data.totalProfit)} currency={data.currency} detail="من الطلبات المسلمة والمدفوعة" tone="mint" />
          <MetricRow icon={<Clock className="h-5 w-5" />} label="أرباح قيد التحصيل" value={fmtMoney(data.pendingProfit)} currency={data.currency} detail="بعد خصم تكلفة الشحن المسجلة" tone="gold" />
          <MetricRow icon={<Package className="h-5 w-5" />} label="عدد الطلبات" value={String(data.orderCount)} detail="كل الطلبات غير الملغاة" tone="sky" />
          <HubCard className="p-4 text-[12px] leading-relaxed text-muted-foreground">
            الأرباح هنا هي قيمة الطلب بعد خصم تكلفة الشحن المسجلة. لا توجد تكلفة شراء للمنتج مسجلة حالياً ليتم خصمها.
          </HubCard>
        </div>
      )}
    </HubShell>
  );
}

function MetricRow({
  icon,
  label,
  value,
  currency,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  currency?: string;
  detail: string;
  tone: "mint" | "gold" | "sky";
}) {
  const tones = {
    mint: "bg-hub-mint-soft text-hub-mint",
    gold: "bg-hub-gold-soft text-hub-gold",
    sky: "bg-hub-sky-soft text-hub-sky",
  };
  return (
    <HubCard className="flex items-center gap-4 p-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="mt-1 flex items-baseline gap-1.5">
          <strong className="hub-display text-2xl leading-none">{value}</strong>
          {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{detail}</span>
      </span>
    </HubCard>
  );
}

function LoadingMetrics() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 w-full rounded-[var(--radius)]" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
