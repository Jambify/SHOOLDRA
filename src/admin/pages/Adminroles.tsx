/**
 * src/admin/pages/AdminRoles.tsx
 * ─────────────────────────────────
 * View, add, and remove admin_users entries.
 *
 * admin_users.user_id has no FK to public.profiles (same situation as
 * question_reports.reported_by), so we fetch profiles separately and
 * merge in JS rather than relying on a PostgREST embed.
 *
 * Adding an admin: the input is an email, but admin_users stores a user_id.
 * We look up the id from `profiles` (which has an `email` column) first.
 * This means the person being added must have already signed up at least
 * once — there's no way to grant admin to an email that's never registered.
 *
 * Owner protection: admin_users.is_owner marks a single permanent account
 * that no one — including other full admins — can remove or demote. This
 * is enforced at the DB level via triggers (prevent_owner_removal,
 * prevent_owner_role_change), not just hidden here in the UI, so it can't
 * be bypassed by direct API calls.
 *
 * Requires admin_users_policies.sql to have been run.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import PageHelmet from "../../components/SEO/PageHelmet";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils/utils";
import ValidatedInput from "../../components/ui/ValidatedInput";
import { logAdminAction } from "../../lib/utils/Auditlog";
import {
  ShieldPlus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  UserCog,
  Lock,
  Crown, // NEW — owner badge
} from "lucide-react";

interface AdminUser {
  user_id: string;
  role: string | null;
  is_owner: boolean; // NEW
  created_at: string;
  profile?: {
    name: string | null;
    email: string | null;
    university: string | null;
  };
}

type ToastType = "success" | "error";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const AdminRoles: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("moderator"); // safer default — bump to "admin" explicitly when needed
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  }, []);
  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);

      const { data: adminRows, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id, role, is_owner, created_at") // NEW: is_owner
        .order("created_at", { ascending: true });

      if (adminError) throw adminError;

      const rows = (adminRows ?? []) as AdminUser[];
      const userIds = rows.map((r) => r.user_id);

      let profileMap = new Map<
        string,
        { name: string | null; email: string | null; university: string | null }
      >();

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, university")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        profileMap = new Map(
          (profilesData ?? []).map((p: any) => [
            p.id,
            { name: p.name, email: p.email, university: p.university },
          ]),
        );
      }

      setAdmins(
        rows.map((r) => ({ ...r, profile: profileMap.get(r.user_id) })),
      );
    } catch (err: any) {
      console.error("Failed to load admins:", err);
      toast("error", "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Only full admins may add/remove — enforced again server-side by
  // is_super_admin() in RLS, this is just for showing/hiding the UI.
  const ownAdmin = admins.find((a) => a.user_id === currentUserId);
  const isFullAdmin = ownAdmin?.role === "admin";

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      toast("error", "Enter an email address");
      return;
    }
    setAdding(true);
    try {
      // Look up the user's id via profiles.email — admin_users needs a
      // user_id, and there's no public API to query auth.users by email.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, name")
        .ilike("email", email)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        toast(
          "error",
          "No account found with that email — they need to sign up first",
        );
        return;
      }

      if (admins.some((a) => a.user_id === profile.id)) {
        toast("error", "This user is already an admin");
        return;
      }

      // is_owner is intentionally never set here — ownership can only be
      // granted directly via SQL, never through this UI or the app's API.
      const { error: insertError } = await supabase
        .from("admin_users")
        .insert({ user_id: profile.id, role: newRole });

      if (insertError) throw insertError;

      logAdminAction("admin_added", profile.email ?? email, {
        role: newRole,
        name: profile.name,
      });

      toast("success", `${profile.name ?? email} added as ${newRole}`);
      setNewEmail("");
      fetchAdmins();
    } catch (err: any) {
      console.error("Failed to add admin:", err);
      toast("error", "Failed to add admin");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (admin: AdminUser) => {
    if (admin.is_owner) {
      toast("error", "The owner account can't be removed");
      return;
    }
    if (admin.user_id === currentUserId) {
      toast("error", "You can't remove your own admin access from here");
      return;
    }
    if (admins.length <= 1) {
      toast("error", "Can't remove the last remaining admin");
      return;
    }

    setRemovingId(admin.user_id);
    try {
      const { error } = await supabase
        .from("admin_users")
        .delete()
        .eq("user_id", admin.user_id);

      // The DB trigger prevent_owner_removal() also blocks this server-side
      // even if this client-side check were somehow bypassed.
      if (error) throw error;

      logAdminAction("admin_removed", admin.profile?.email ?? admin.user_id, {
        role: admin.role,
        name: admin.profile?.name,
      });

      setAdmins((prev) => prev.filter((a) => a.user_id !== admin.user_id));
      toast("success", "Admin access removed");
    } catch (err: any) {
      console.error("Failed to remove admin:", err);
      toast("error", "Failed to remove admin");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHelmet
        title="Admin Roles | SCHOOLDRA"
        description="Manage admin roles and permissions, add or remove admin access, and view owner protection info."
        canonical="https://www.schooldra.com/admin/roles"
      />
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-semibold">Admin Roles</h2>
        <p className="text-textDim text-sm">
          Manage who has access to the admin panel.
        </p>
      </div>

      {/* Add admin — full admins only. Also enforced server-side via
          is_super_admin() in RLS, so this isn't just a UI-level restriction. */}
      {!loading && !isFullAdmin ? (
        <div className="bg-bgCard border-borderMuted flex items-center gap-3 rounded-xl border p-5">
          <Lock className="text-textDim h-4 w-4 shrink-0" />
          <p className="text-textDim text-sm">
            Only admins can add or remove roles. Moderators can view this list.
          </p>
        </div>
      ) : (
        <div className="bg-bgCard border-borderMuted space-y-3 rounded-xl border p-5">
          <p className="text-textDim text-xs font-bold tracking-widest uppercase">
            Add Admin
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ValidatedInput
              value={newEmail}
              onChange={(v) => setNewEmail(v.slice(0, 254))}
              placeholder="user@example.com"
              type="email"
              className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="bg-bgSurface border-borderMuted text-textMain focus:border-brand rounded-lg border px-3 py-2.5 text-sm outline-none"
            >
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="bg-brand hover:bg-brand-light flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldPlus className="h-4 w-4" />
              )}
              Add
            </button>
          </div>
          <p className="text-textDim text-xs">
            The person must already have a Schooldra account — you can't grant
            access to an email that hasn't signed up.
          </p>
        </div>
      )}

      {/* Admin list */}
      <div className="bg-bgCard border-borderMuted overflow-hidden rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-brand h-6 w-6 animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <UserCog className="text-textDim h-10 w-10" />
            <p className="text-textDim text-sm">No admins found</p>
          </div>
        ) : (
          <div className="divide-borderMuted divide-y">
            {admins.map((admin) => {
              const isSelf = admin.user_id === currentUserId;
              return (
                <div
                  key={admin.user_id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-textMain truncate text-sm font-medium">
                        {admin.profile?.name ?? "Unknown user"}
                      </p>
                      {isSelf && (
                        <span className="bg-brand/10 text-brand-light rounded-full px-2 py-0.5 text-[10px] font-bold">
                          You
                        </span>
                      )}
                      {admin.is_owner && (
                        <span className="bg-warn/10 text-warn flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                          <Crown className="h-2.5 w-2.5" />
                          Owner
                        </span>
                      )}
                      <span className="bg-bgSurface text-textDim rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                        {admin.role ?? "admin"}
                      </span>
                    </div>
                    <p className="text-textDim truncate text-xs">
                      {admin.profile?.email ?? admin.user_id}
                      {admin.profile?.university
                        ? ` · ${admin.profile.university}`
                        : ""}
                    </p>
                  </div>
                  {isFullAdmin && (
                    <button
                      onClick={() => handleRemove(admin)}
                      disabled={
                        removingId === admin.user_id ||
                        isSelf ||
                        admin.is_owner ||
                        admins.length <= 1
                      }
                      title={
                        admin.is_owner
                          ? "The owner account can't be removed"
                          : isSelf
                            ? "You can't remove your own access"
                            : "Remove admin access"
                      }
                      className={cn(
                        "shrink-0 rounded-lg p-2",
                        isSelf || admin.is_owner || admins.length <= 1
                          ? "text-textDim/40 cursor-not-allowed"
                          : "text-textDim hover:bg-danger/10 hover:text-danger",
                      )}
                    >
                      {removingId === admin.user_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast container */}
      <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-brand-lg pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-xl",
              t.type === "success"
                ? "bg-success/10 border-success/30 text-success border"
                : "bg-danger/10 border-danger/30 text-danger border",
            )}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminRoles;
