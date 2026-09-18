/** Server-only session reader that throws when unauthenticated. */
import { getSession } from "@tanstack/react-start/server";
import { getSessionConfig, type AppSessionData } from "@/lib/session.server";
import { resolveStaffAccess, type StaffAccess } from "@/lib/staff.server";
import { PERMISSION_LABELS, type StaffPermission } from "@/lib/staff-permissions";

/**
 * Returns the STORE OWNER user id (all store data is scoped by it) together
 * with the signed-in account. Staff members act inside the owner's store, so
 * `userId` is the owner id for them too.
 *
 * Pass a permission to reject staff who were not granted that area.
 */
export async function requireUserId(
  permission?: StaffPermission,
): Promise<{ userId: string; email: string; access: StaffAccess }> {
  const session = await getSession<AppSessionData>(getSessionConfig());
  if (!session.data?.userId) {
    throw new Error("يجب تسجيل الدخول أولاً.");
  }
  const email = session.data.email ?? "";
  const access = await resolveStaffAccess(session.data.userId, email);

  if (permission && !access.isOwner && !access.permissions.includes(permission)) {
    throw new Error(`ليس لديك صلاحية: ${PERMISSION_LABELS[permission]}.`);
  }

  return { userId: access.ownerUserId, email, access };
}

/** Same as requireUserId but fails unless the account owns the store. */
export async function requireOwner(): Promise<{ userId: string; email: string }> {
  const { userId, email, access } = await requireUserId();
  if (!access.isOwner) throw new Error("هذه الصفحة متاحة لصاحب المتجر فقط.");
  return { userId, email };
}
