/**
 * Browser-safe permission catalogue for store staff.
 * Presentation + shared validation only; enforcement lives on the server
 * (see `src/lib/staff.server.ts` and `src/lib/session-guard.server.ts`).
 */

export const STAFF_PERMISSIONS = [
  "orders",
  "products",
  "website",
  "offers",
  "earnings",
  "shipping",
  "payments",
  "policies",
  "contacts",
  "conversations",
  "knowledge",
  "staff",
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<StaffPermission, string> = {
  orders: "الطلبات",
  products: "المخزون والمنتجات",
  website: "الموقع والنشر",
  offers: "العروض والخصومات",
  earnings: "الأرباح",
  shipping: "الشحن",
  payments: "طرق الدفع",
  policies: "السياسات",
  contacts: "بيانات التواصل",
  conversations: "المحادثات",
  knowledge: "معلومات المتجر",
  staff: "إدارة الموظفين",
};

export const PERMISSION_HINTS: Record<StaffPermission, string> = {
  orders: "عرض الطلبات وتغيير حالتها",
  products: "إضافة وتعديل المنتجات والكميات",
  website: "تعديل واجهة المتجر والنشر",
  offers: "إنشاء وتعديل العروض",
  earnings: "الاطلاع على الأرباح والتحصيل",
  shipping: "المناطق وتكلفة الشحن",
  payments: "طرق استلام المال",
  policies: "شروط وسياسات المتجر",
  contacts: "أرقام وبيانات التواصل",
  conversations: "الرد على العملاء وإعدادات المساعد",
  knowledge: "المعلومات الناقصة وملفات المتجر",
  staff: "دعوة الموظفين وتعديل صلاحياتهم",
};

export function normalizePermissions(value: unknown): StaffPermission[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(STAFF_PERMISSIONS);
  const out: StaffPermission[] = [];
  for (const raw of value) {
    const key = String(raw ?? "").trim();
    if (allowed.has(key) && !out.includes(key as StaffPermission)) {
      out.push(key as StaffPermission);
    }
  }
  return out;
}

export function hasPermission(
  isOwner: boolean,
  permissions: readonly string[],
  needed: StaffPermission,
): boolean {
  return isOwner || permissions.includes(needed);
}
