import React from "react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "../../lib/utils/utils";
import { useUserStore } from "../../Store/useUserStore";
import { MessageSquare, Trophy, Sparkles, ArrowRight } from "lucide-react";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import ThemeToggle from "../ui/ThemeToggle";
interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

const MAIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Practice Quiz",
    path: "/quiz",
    badge: 3,
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    label: "Subjects",
    path: "/subjects",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    label: "Performance",
    path: "/performance",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: "Settings",
    path: "/settings",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const STUDY_NAV: NavItem[] = [
  {
    label: "Mock Exams",
    path: "/mock-exams",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Past Questions",
    path: "/past-questions",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: "Study Groups",
    path: "/study-groups",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },

  {
    label: "Chat with Mentor",
    path: "/mentor", // New Link added here
    icon: <MessageSquare size={16} strokeWidth={1.8} />,
    badge: 1,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { name, streak, isPro } = useUserStore();
  const navigate = useNavigate();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-110 bg-black/40 backdrop-blur-xs lg:hidden dark:bg-black/60"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-120 h-full w-64 lg:hidden",
          "bg-bgDeep border-borderMuted border-r",
          "flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation sidebar"
      >
        {/* Logo */}
        <div className="border-borderMuted flex items-center justify-between border-b px-5 py-5">
          <a
            href="/dashboard"
            aria-label="Schooldra Home"
            className="flex items-center gap-1"
          >
            <img
              src={schooldraLogo}
              alt="Schooldra Logo"
              className="h-8 w-8"
              width={32}
              height={32}
              loading="eager"
            />

            <span className="text-brand-light text-lg font-black tracking-wider">
              Schooldra
            </span>
          </a>
          {isPro && (
            <div className="bg-brand/10 text-brand border-brand/20 rounded border px-2 py-1 text-[10px] font-black tracking-widest uppercase">
              Pro
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
          aria-label="Main navigation"
        >
          <NavSection
            label="Main"
            labelId="main-nav-label"
            items={MAIN_NAV}
            onNavigate={onClose}
          />
          <NavSection
            label="Study"
            labelId="study-nav-label"
            items={STUDY_NAV}
            onNavigate={onClose}
          />

          {/* Help & Support */}
          <div className="border-borderMuted/30 mt-4 border-t pt-4">
            <NavLink
              to="/settings"
              state={{ activeTab: "help" }}
              onClick={onClose}
              className="text-textMuted hover:text-textMain hover:bg-bgSurface rounded-brand mb-0.5 flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 12" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Help & Support</span>
            </NavLink>
          </div>

          {/* Pro Section Link */}
          <div className="border-borderMuted/30 mt-4 border-t pt-4">
            {!isPro ? (
              <NavLink
                to="/pro"
                onClick={onClose}
                className="from-brand/10 to-brand/5 border-brand/20 text-brand-light hover:border-brand/40 group flex flex-col gap-2 rounded-2xl border bg-linear-to-br p-3.5 shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="text-brand h-4 w-4 transition-transform group-hover:rotate-12" />
                  <span className="text-[13px] font-black tracking-wider uppercase">
                    Schooldra Pro
                  </span>
                </div>
                <p className="text-textDim text-[11px] leading-tight">
                  Unlock AI explanations, offline question packs, and
                  professional mock review.
                </p>
                <div className="text-brand-light mt-1 flex items-center gap-1 text-[10px] font-bold">
                  Upgrade Now <ArrowRight size={10} />
                </div>
              </NavLink>
            ) : (
              <div className="bg-success/5 border-success/10 text-success flex items-center gap-3 rounded-2xl border p-3.5 shadow-inner">
                <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-xl">
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[12px] font-black tracking-wider uppercase">
                    Pro Member
                  </span>
                  <span className="text-success/70 text-[10px] font-medium italic">
                    Premium access active
                  </span>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* User footer */}
        <div className="border-borderMuted border-t p-3">
          <button
            onClick={() => {
              navigate("/settings");
              onClose();
            }}
            className="rounded-brand hover:bg-bgSurface flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
          >
            <div className="bg-brand font-display relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
              {initials}
              {isPro && (
                <div className="bg-brand border-bgDeep absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2">
                  <div className="h-1 w-1 rounded-full bg-white" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-textDim text-[11px]">
                {isPro ? "Pro Member" : "Free Tier"} · 🔥 {streak} day streak
              </p>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="text-textDim shrink-0"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {/* Theme Toggle */}
          <div className="mt-2 flex items-center justify-between px-3 py-2">
            <span className="text-textDim text-xs font-medium">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
};

/** Reusable nav section with label + items */
const NavSection: React.FC<{
  label: string;
  labelId: string;
  items: NavItem[];
  onNavigate: () => void;
}> = ({ label, labelId, items, onNavigate }) => (
  <section aria-labelledby={labelId}>
    <h2
      id={labelId}
      className="text-textDim mb-1.5 px-3 text-[10px] font-medium tracking-widest uppercase"
    >
      {label}
    </h2>
    {items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/"}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "rounded-brand mb-0.5 flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-200 ease-out",
            isActive
              ? "bg-brand/12 text-brand-light shadow-brand/10 font-medium shadow-md"
              : "text-textMuted hover:bg-bgSurface hover:text-textMain",
          )
        }
      >
        <span className="shrink-0 transition-opacity duration-200 ease-out">
          {item.icon}
        </span>
        <span className="flex-1">{item.label}</span>
        {item.badge != null && (
          <span className="bg-brand shadow-brand/15 min-w-4.5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white shadow">
            {/* {item.badge} */}
          </span>
        )}
      </NavLink>
    ))}
  </section>
);

export default Sidebar;
