/**
 * src/admin/AdminLayout.tsx
 * ──────────────────────────
 * Shell layout for the admin panel.
 * Completely separate from AppLayout — no student UI bleeds in.
 *
 * NAV order changed to priority: things that need frequent/urgent attention
 * first, sensitive/occasional admin housekeeping last.
 *   1. Overview          — daily glance, entry point
 *   2. Flagged Reports    — time-sensitive, students are waiting
 *   3. Users              — day-to-day account management
 *   4. Question Bank      — content management
 *   5. AdminBroadcast     — occasional campaigns
 *   6. Admin Roles        — sensitive, infrequent
 *   7. Audit Log          — infrequent review/oversight
 */

import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "../lib/utils/utils";
import {
  Users,
  BarChart2,
  ShieldAlert,
  Menu,
  X,
  Home,
  Clock,
  Megaphone,
  Database,
  AlertTriangle,
  UserCog,
  Layers,
  LogOut,
} from "lucide-react";
import schooldraLogo from "../assets/schooldraLogo.webp";
import { ToastBar, useToast } from "../hooks/useToast";
import { useUserStore } from "../Store/useUserStore";
import { consumeAdminWelcomeToast } from "./adminWelcome";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const NAV = [
  { path: "/admin", label: "Overview", icon: BarChart2, end: true },
  {
    path: "/admin/reports",
    label: "FlaggedReports",
    icon: AlertTriangle,
    end: false,
  },
  { path: "/admin/users", label: "Users", icon: Users, end: false },
  {
    path: "/admin/Adminquestions",
    label: "AdminQuestions",
    icon: Database,
    end: false,
  },
  { path: "/admin/topics", label: "TopicOverview", icon: Layers, end: false },
  {
    path: "/admin/AdminBroadcast",
    label: "AdminBroadcast",
    icon: Megaphone,
    end: false,
  },
  { path: "/admin/roles", label: "Admin Roles", icon: UserCog, end: false },
  { path: "/admin/audit-log", label: "Audit Log", icon: Clock, end: false },
];
const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { toasts, toast, removeToast } = useToast();
  const name = useUserStore((s) => s.name);
  const email = useUserStore((s) => s.email);

  useEffect(() => {
    if (consumeAdminWelcomeToast()) {
      const display = name?.trim() || email?.split("@")[0] || "Admin";
      toast("success", `Welcome back, ${display}`);
    }
  }, [toast, name, email]);

  return (
    <div className="bg-bgMain text-textMain relative min-h-screen">
      {/* ── Mobile overlay ──────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-60 flex-col",
          "bg-bgSurface border-borderMuted border-r",
          "transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="border-borderMuted flex shrink-0 items-center justify-between border-b px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex cursor-pointer items-center gap-1">
              <img
                src={schooldraLogo}
                alt="Schooldra Logo"
                className="h-8 w-8"
                width={32}
                height={32}
                loading="eager"
              />
            </div>
            <div className="font-display text-sm font-bold tracking-tight">
              Schooldra{" "}
              <span className="text-brand ml-1 text-[10px] font-bold tracking-widest uppercase">
                Admin
              </span>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-textDim hover:text-textMain lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ path, label, icon: Icon, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "rounded-brand flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "bg-brand/10 text-brand-light font-semibold"
                    : "text-textMuted hover:bg-bgCard hover:text-textMain",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-borderMuted shrink-0 space-y-1 border-t p-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-brand text-textMuted hover:bg-bgCard hover:text-textMain flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-all"
          >
            <Home className="h-4 w-4 shrink-0" />
            Back to App
          </button>
          <button
            onClick={async () => {
              await useUserStore.getState().signOut();
              navigate("/signin", { replace: true });
            }}
            className="rounded-brand text-danger hover:bg-danger/10 border-danger/0 hover:border-danger/20 flex w-full items-center gap-2.5 border px-3 py-2.5 text-sm transition-all"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
          <div className="text-textDim flex items-center gap-2 px-3 py-2 text-[10px]">
            <ShieldAlert className="text-warn h-3 w-3 shrink-0" />
            Admin access only
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        {/* Topbar */}
        <header className="bg-bgMain/90 border-borderMuted sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-7">
          <button
            onClick={() => setOpen(true)}
            className="rounded-brand hover:bg-bgSurface text-textMuted p-2 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="font-display flex-1 text-base font-semibold tracking-tight">
            {title}
          </h1>
          <div className="bg-brand/10 border-brand/20 flex items-center gap-2 rounded-full border px-3 py-1.5">
            <ShieldAlert className="text-brand-light h-3.5 w-3.5" />
            <span className="text-brand-light text-[11px] font-bold tracking-widest uppercase">
              Admin
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-7">{children}</main>
      </div>

      <ToastBar toasts={toasts} remove={removeToast} />
    </div>
  );
};

export default AdminLayout;
