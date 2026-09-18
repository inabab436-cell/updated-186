/**
 * Server-only staff resolution.
 *
 * Every dashboard query in the app is scoped by `user_id = <store owner>`.
 * A staff member therefore works "inside" the owner's account: their session
 * user id is translated to the owner's user id, and a permission list decides
 * which areas they may touch.
 *
 * MUST NOT be imported from browser code.
 */
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizePermissions,
  type StaffPermission,
} from "@/lib/staff-permissions";

const TABLE = "store_staff";

export interface StaffAccess {
  /** The user id that owns the store data (the owner, even for staff). */
  ownerUserId: string;
  /** The signed-in account itself. */
  actorUserId: string;
  isOwner: boolean;
  permissions: StaffPermission[];
  staffId: string | null;
  name: string | null;
}

/** Attach a pending invite to the account that just signed in with that email. */
export async function linkStaffByEmail(userId: string, email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  try {
    const admin = getSupabaseAdmin();
    await admin
      .from(TABLE)
      .update({
        member_user_id: userId,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("email", clean)
      .is("member_user_id", null);
  } catch {
    /* linking is best-effort; sign-in must not fail because of it */
  }
}

/** Resolve what the signed-in account may do and whose store it belongs to. */
export async function resolveStaffAccess(
  actorUserId: string,
  actorEmail: string,
): Promise<StaffAccess> {
  const owner: StaffAccess = {
    ownerUserId: actorUserId,
    actorUserId,
    isOwner: true,
    permissions: [],
    staffId: null,
    name: null,
  };

  try {
    const admin = getSupabaseAdmin();
    const email = actorEmail.trim().toLowerCase();
    let query = admin
      .from(TABLE)
      .select("id, owner_user_id, permissions, status, name")
      .eq("status", "active")
      .limit(1);
    query = email
      ? query.or(`member_user_id.eq.${actorUserId},email.eq.${email}`)
      : query.eq("member_user_id", actorUserId);

    const { data } = await query.maybeSingle();
    if (!data) return owner;

    const row = data as {
      id: string;
      owner_user_id: string;
      permissions: unknown;
      name: string | null;
    };
    if (String(row.owner_user_id) === actorUserId) return owner;

    return {
      ownerUserId: String(row.owner_user_id),
      actorUserId,
      isOwner: false,
      permissions: normalizePermissions(row.permissions),
      staffId: String(row.id),
      name: row.name ?? null,
    };
  } catch {
    return owner;
  }
}
