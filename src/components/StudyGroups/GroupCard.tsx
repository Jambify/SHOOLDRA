import React from "react";
import type { StudyGroup } from "../../Store/useGroupStore";
import Button from "../ui/Button";
import { sanitizeXss } from "../../lib/utils/utils";
import { getSubjectColor } from "../../lib/subjectMeta";
import { Users, MessageCircle, Activity } from "lucide-react";

interface Props {
  group: StudyGroup;
  isMember: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onOpen: () => void;
}

const GroupCard: React.FC<Props> = ({
  group,
  isMember,
  onJoin,
  onOpen,
  onLeave,
}) => {
  const color = getSubjectColor(group.subject);

  return (
    <div className="bg-bgCard border-borderMuted rounded-brand-lg flex flex-col gap-4 border p-5 transition-all hover:border-white/10">
      <div className="flex items-start gap-3">
        <div
          className="rounded-brand flex h-11 w-11 shrink-0 items-center justify-center text-xl"
          style={{
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {group.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display truncate text-sm font-semibold tracking-tight">
              {sanitizeXss(group.name)}
            </h3>
            {isMember && (
              <span className="bg-success/15 text-success border-success/20 rounded-full border px-2 py-0.5 text-[9px] font-bold">
                JOINED
              </span>
            )}
          </div>
          <div className="text-textDim mt-0.5 flex items-center gap-2 text-[11px]">
            <Users className="h-3 w-3" />
            <span>{group.member_count}</span>
            <span>·</span>
            <span>{group.subject}</span>
          </div>
        </div>
      </div>

      <p className="text-textMuted line-clamp-2 text-xs leading-relaxed">
        {sanitizeXss(group.description || "No description provided.")}
      </p>

      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-2">
          {group.recentMembers.slice(0, 4).map((m, i) => (
            <div
              key={i}
              className="border-bgCard flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold"
              style={{
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
              }}
            >
              {sanitizeXss(m.slice(0, 1).toUpperCase())}
            </div>
          ))}
        </div>
        <span className="text-textDim text-[11px]">
          {group.member_count > 4
            ? `+${group.member_count - 4} more`
            : `${group.member_count} members`}
        </span>
        <span className="ml-auto text-[10px]">
          {group.isActive ? (
            <span className="text-success flex items-center gap-1">
              <Activity className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="text-textDim flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> Quiet
            </span>
          )}
        </span>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" fullWidth onClick={onOpen}>
          {isMember ? "Open chat" : "Preview"}
        </Button>
        {!isMember && (
          <Button variant="secondary" size="sm" onClick={onJoin}>
            Join
          </Button>
        )}
        {isMember && (
          <Button variant="ghost" size="sm" onClick={onLeave}>
            Leave
          </Button>
        )}
      </div>
    </div>
  );
};

export default GroupCard;
