/**
 * Staff management endpoints (owner-only, plus a read of the caller's own
 * access used to hide areas the signed-in person may not open).
 */
import { createServerFn } from "@tanstack/react-start";

import {
  normalizePermissions,
  type StaffPermission,
} from "@/lib/staff-permissions";

function bad(msg: string): never {
  throw new Error(msg);
}

function cleanEmail(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) bad("بريد إلكتروني غير صالح.");
  return s;
}

export interface StaffRow {
  id: string;
  email: string;
  name: string | null;
  permissions: StaffPermission[];
  status: "pending" | "active" | "disabled";
  created_at: string;
}

export interface MyAccess {
  isOwner: boolean;
  permissions: StaffPermission[];
  email: string;
  name: string | null;
}

export const getMyAccess = createServerFn({ method: "GET" }).handler(
  async (): Promise<MyAccess> => {
    const { requireUserId } = await import("@/lib/session-guard.server");
    const { email, access } = await requireUserId();
    return {
      isOwner: access.isOwner,
      permissions: access.permissions,
      email,
      name: access.name,
    };
  },
);

export const listStaff = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffRow[]> => {
    const { requireUserId } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requireUserId("staff");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("store_staff")
      .select("id, email, name, permissions, status, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: String((r as { id: string }).id),
      email: String((r as { email: string }).email),
      name: ((r as { name: string | null }).name) ?? null,
      permissions: normalizePermissions((r as { permissions: unknown }).permissions),
      status: ((r as { status: StaffRow["status"] }).status) ?? "pending",
      created_at: String((r as { created_at: string }).created_at),
    }));
  },
);

export const inviteStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; name?: string | null; permissions: string[] }) => ({
    email: cleanEmail(d?.email),
    name: d?.name ? String(d.name).trim().slice(0, 80) : null,
    permissions: normalizePermissions(d?.permissions),
  }))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId, email: ownerEmail } = await requireUserId("staff");
    if (data.email === ownerEmail.trim().toLowerCase()) {
      bad("هذا بريدك أنت، وأنت صاحب المتجر بالفعل.");
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("store_staff").upsert(
      {
        owner_user_id: userId,
        email: data.email,
        name: data.name,
        permissions: data.permissions,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_user_id,email" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { id: string; permissions?: string[]; status?: string; name?: string | null }) => {
      if (!d?.id) bad("معرّف الموظف مفقود.");
      return d;
    },
  )
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requireUserId("staff");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.permissions) patch.permissions = normalizePermissions(data.permissions);
    if (data.name !== undefined) patch.name = data.name ? String(data.name).slice(0, 80) : null;
    if (data.status) {
      if (!["pending", "active", "disabled"].includes(data.status)) bad("حالة غير صالحة.");
      patch.status = data.status;
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("store_staff")
      .update(patch)
      .eq("id", data.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => {
    if (!d?.id) bad("معرّف الموظف مفقود.");
    return { id: String(d.id) };
  })
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/session-guard.server");
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = await requireUserId("staff");
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("store_staff")
      .delete()
      .eq("id", data.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
