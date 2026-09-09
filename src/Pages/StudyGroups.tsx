import React, { useState, useEffect } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import AppLayout from "../components/Layout/AppLayout";
import { useGroupStore } from "../Store/useGroupStore";
import GroupCard from "../components/StudyGroups/GroupCard";
import GroupChat from "../components/StudyGroups/GroupChat";
import CreateGroupModal from "../components/StudyGroups/CreateGroupModal";
import Button from "../components/ui/Button";
import { cn } from "../lib/utils/utils";
import {
  Users,
  Plus,
  Search,
  TriangleAlert,
  Filter,
  Beaker,
  Cpu,
  Palette,
  Hash,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ValidatedInput from "../components/ui/ValidatedInput";
import { truncateInput } from "../lib/validation";
import SectionError from "../components/ui/SectionError";
import ErrorBanner from "../components/ui/ErrorBanner";

const CATEGORIES = [
  { id: "all", name: "All", icon: Filter },
  {
    id: "science",
    name: "Science",
    icon: Beaker,
    subjects: ["Physics", "Chemistry", "Biology", "Mathematics"],
  },
  {
    id: "engineering",
    name: "Engineering",
    icon: Cpu,
    subjects: ["Mathematics", "Physics"],
  },
  {
    id: "arts",
    name: "Arts",
    icon: Palette,
    subjects: ["English", "Literature", "Economics", "Government", "CRS/IRS"],
  },
];

const StudyGroups: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<"discover" | "my-groups">("discover");
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState(""); // 👈 New Search State
  const [leaveId, setLeaveId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const {
    groups,
    myGroupIds,
    loading,
    error,
    loadGroups,
    loadMyGroups,
    joinGroup,
    leaveGroup,
    joinByCode,
  } = useGroupStore();

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([loadGroups(), loadMyGroups()]);
    } finally {
      setTimeout(() => setIsManualRefreshing(false), 600);
    }
  };

  useEffect(() => {
    loadGroups();
    loadMyGroups();
  }, []);

  const myGroups = groups.filter((g) => myGroupIds.includes(g.id));
  const discoverGroups = groups.filter((g) => !myGroupIds.includes(g.id));
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  const filterAndSortGroups = (list: typeof groups, isDiscoverTab: boolean) => {
    // 1. First filter by Category
    let result = list;
    if (category !== "all") {
      const cat = CATEGORIES.find((c) => c.id === category);
      if (cat?.subjects) {
        result = result.filter(
          (g) => cat.subjects!.includes(g.subject) || g.subject === "Mixed",
        );
      }
    }

    // 2. Next, apply search criteria if text exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.subject.toLowerCase().includes(query),
      );
    }

    // 3. If on Discover tab and NOT searching, sort by popularity and return the top 6
    if (isDiscoverTab) {
      return [...result]
        .sort((a, b) => {
          // Sort by member count (highest first). Fallback to interaction metric if present on group model
          //  TO THIS:
          const countA = a.member_count || 0;
          const countB = b.member_count || 0;
          return countB - countA;
        })
        .slice(0, 6); // 👈 Limit to top 6
    }

    return result;
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoinError("");
    setJoining(true);
    const { error } = await joinByCode(joinCode);
    setJoining(false);
    if (error) setJoinError(error);
    else {
      setJoinCode("");
      setTab("my-groups");
    }
  };

  if (activeGroup) {
    return (
      <AppLayout
        currentPage="groups"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      >
        <div className="bg-bgMain fixed top-14 right-0 bottom-18 left-0 z-40 flex flex-col lg:bottom-0 lg:left-60">
          <GroupChat
            group={activeGroup}
            onBack={() => setActiveGroupId(null)}
          />
        </div>
      </AppLayout>
    );
  }

  const displayedDiscover = filterAndSortGroups(discoverGroups, true);
  const displayedMyGroups = filterAndSortGroups(myGroups, false);

  const hasData = groups.length > 0;
  const showFullError = !!error && !loading && !hasData;
  const showRefreshBanner = !!error && hasData;

  return (
    <AppLayout
      currentPage="groups"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Study Groups | SCHOOLDRA"
        description="Join or create study groups to collaborate with peers, share resources, and improve together for JAMB UTME."
        canonical="https://www.schooldra.com/study-groups"
      />

      {showRefreshBanner && (
        <ErrorBanner
          message={error || ""}
          onRetry={handleManualRefresh}
          isRetrying={isManualRefreshing}
        />
      )}

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Study Groups
          </h2>
          <p className="text-textMuted mt-1 text-sm">
            Study with peers, share strategies, challenge each other.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Create group
        </Button>
      </div>

      {/* Utilities Container: Join By Code & Discover Search Bar */}
      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Join by code */}
        <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-4">
          <p className="text-textDim mb-2 text-xs font-medium tracking-widest uppercase">
            Join by code
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="text-textDim absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
              <ValidatedInput
                value={joinCode}
                onChange={(v) => {
                  setJoinCode(truncateInput(v.toUpperCase(), 8));
                  setJoinError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="bg-bgSurface border-borderMuted rounded-brand text-textMain placeholder:text-textDim focus:border-brand/40 w-full border py-2 pr-3 pl-8 font-mono text-sm transition-colors focus:outline-none"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleJoinByCode}
              disabled={!joinCode.trim() || joining}
            >
              {joining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Join"
              )}
            </Button>
          </div>
          {joinError && <p className="text-danger mt-2 text-xs">{joinError}</p>}
        </div>

        {/* Dynamic Search Box */}
        <div className="bg-bgCard border-borderMuted rounded-brand-lg flex flex-col justify-end border p-4">
          <p className="text-textDim mb-2 text-xs font-medium tracking-widest uppercase">
            Find Other Squads
          </p>
          <div className="relative">
            <Search className="text-textDim absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <ValidatedInput
              type="text"
              value={searchQuery}
              onChange={(v) => setSearchQuery(truncateInput(v, 200))}
              placeholder="Search by squad name or subject..."
              className="bg-bgSurface border-borderMuted rounded-brand text-textMain placeholder:text-textDim focus:border-brand/40 w-full border py-2 pr-3 pl-9 text-sm transition-colors focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-bgSurface border-borderMuted rounded-brand mb-4 flex w-fit gap-1 border p-1">
        {(["discover", "my-groups"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-brand flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all",
              tab === t
                ? "bg-bgCard text-textMain border-borderMuted border shadow-sm"
                : "text-textMuted hover:text-textMain",
            )}
          >
            {t === "discover" ? (
              <>
                <Search className="h-3 w-3" /> Discover Hot Squads
              </>
            ) : (
              <>
                <Users className="h-3 w-3" /> My groups
                {myGroups.length > 0 && ` (${myGroups.length})`}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-brand flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-all",
                category === c.id
                  ? "bg-bgCard text-textMain border-borderMuted shadow-sm"
                  : "text-textMuted hover:text-textMain border-transparent",
              )}
            >
              <Icon className="h-3 w-3" /> {c.name}
            </button>
          );
        })}
      </div>

      {/* Header Label for Context */}
      {!loading && tab === "discover" && !searchQuery && (
        <p className="text-textMuted mb-3 text-xs font-semibold tracking-wide uppercase">
          🔥 Top Trending Squads
        </p>
      )}

      {/* Loading - scoped skeleton cards in grid, or SectionError on failure */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <div
              key={g}
              className="bg-bgCard overflow-hidden rounded-2xl shadow-sm"
            >
              <div className="bg-bgSurface skeleton-shimmer h-28 w-full" />
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="bg-bgSurface skeleton-shimmer h-5 w-40 rounded" />
                    <div className="bg-bgSurface skeleton-shimmer h-3 w-24 rounded" />
                  </div>
                  <div className="bg-bgSurface skeleton-shimmer h-6 w-6 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-bgSurface skeleton-shimmer h-6 w-6 rounded-full" />
                  <div className="bg-bgSurface skeleton-shimmer h-3 w-20 rounded" />
                  <div className="ml-auto flex -space-x-2">
                    {[1, 2, 3].map((m) => (
                      <div key={m} className="bg-bgSurface skeleton-shimmer h-6 w-6 rounded-full" />
                    ))}
                  </div>
                  <div className="bg-bgSurface skeleton-shimmer h-3 w-8 rounded" />
                </div>
                <div className="bg-bgSurface skeleton-shimmer h-10 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : showFullError ? (
        <SectionError
          message={error || ""}
          onRetry={handleManualRefresh}
          isRetrying={isManualRefreshing}
        />
      ) : (
        (tab === "discover" ? (
          displayedDiscover.length === 0 ? (
            <div className="text-textDim py-12 text-center text-sm">
              No squads found matching your filters or search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedDiscover.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GroupCard
                    group={g}
                    isMember={false}
                    onJoin={() => joinGroup(g.id)}
                    onOpen={() => setActiveGroupId(g.id)}
                  />
                </motion.div>
              ))}
            </div>
          )
        ) : displayedMyGroups.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-textDim mb-4 text-sm">
              {myGroups.length === 0
                ? "You haven't joined any groups yet."
                : "No groups found in this selection."}
            </p>
            {myGroups.length === 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTab("discover")}
              >
                Browse groups
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedMyGroups.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GroupCard
                  group={g}
                  isMember={true}
                  onLeave={() => setLeaveId(g.id)}
                  onOpen={() => setActiveGroupId(g.id)}
                />
              </motion.div>
            ))}
          </div>
        )))}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}

      {/* Leave confirm */}
      <AnimatePresence>
        {leaveId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setLeaveId(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-bgCard border-borderMuted rounded-brand-2xl w-full max-w-md border p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                  <TriangleAlert className="h-7 w-7 text-amber-500" />
                </div>
              </div>
              <h3 className="mb-2 text-center text-xl font-bold">
                Leave this Squad?
              </h3>
              <p className="text-textMuted mb-6 text-center text-sm">
                You will lose access to the group chat and resources.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setLeaveId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  className="border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  onClick={() => {
                    leaveGroup(leaveId!);
                    setLeaveId(null);
                  }}
                >
                  Yes, Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default StudyGroups;
