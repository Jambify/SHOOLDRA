import React from "react";
import { useOfflineStore } from "../../Store/useOfflineStore";
import { cn } from "../../lib/utils/utils";
import { getSubjectColor } from "../../lib/subjectMeta";
import {
  BookOpen,
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  TrendingUp,
  Landmark,
  BookMarked,
  Globe,
  Church,
  Briefcase,
  ScrollText,
  Moon,
  type LucideIcon,
} from "lucide-react";

export interface OfflinePack {
  id: string;
  subject: string;
  years: string;
  count: number;
  size: string;
}

const SUBJ_ICONS: Record<string, LucideIcon> = {
  English: BookOpen,
  Mathematics: Calculator,
  Physics: Zap,
  Chemistry: FlaskConical,
  Biology: Dna,
  Economics: TrendingUp,
  Government: Landmark,
  Literature: BookMarked,
  Geography: Globe,
  CRS: Church,
  Commerce: Briefcase,
  History: ScrollText,
  IRS: Moon,
};

const OfflinePackCard: React.FC<{ pack: OfflinePack }> = ({ pack }) => {
  const { downloadedPacks, downloadingId, downloadPack, removePack } =
    useOfflineStore();
  const isDownloaded = downloadedPacks.includes(pack.id);
  const isDownloading = downloadingId === pack.id;
  const color = getSubjectColor(pack.subject);
  const Icon = SUBJ_ICONS[pack.subject] ?? BookOpen;

  // FIX: count/size are placeholder ("0" / "— (TODO)") until real per-subject
  // numbers are measured — see the TODOs in Data/offlinePacks.ts. Rather than
  // show a fake "0 questions" or a raw "TODO" string to users, hide that line
  // entirely until real values are filled in. Once offlinePacks.ts has real
  // numbers for every pack, this condition naturally starts showing it.
  const hasRealMeta = pack.count > 0 && !pack.size.includes("TODO");

  return (
    <div
      className={cn(
        "bg-bgCard rounded-brand-lg flex items-center gap-4 border p-4 transition-all",
        isDownloaded
          ? "border-success/30"
          : "border-borderMuted hover:border-white/10",
      )}
    >
      <div
        className="rounded-brand flex h-11 w-11 shrink-0 items-center justify-center"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{pack.subject}</p>
        {hasRealMeta && (
          <p className="text-textDim mt-0.5 text-[11px]">
            {pack.count} questions · {pack.years} · {pack.size}
          </p>
        )}
        {isDownloaded && (
          <p className="text-success mt-1 flex items-center gap-1 text-[11px]">
            ✓ Downloaded — available offline
          </p>
        )}
        {isDownloading && (
          <div className="bg-bgSurface mt-2 h-1 overflow-hidden rounded-full">
            <div
              className="bg-brand h-full animate-pulse rounded-full"
              style={{ width: "60%" }}
            />
          </div>
        )}
      </div>
      <div className="shrink-0">
        {isDownloading ? (
          <button disabled>Downloading…</button>
        ) : isDownloaded ? (
          <button onClick={() => removePack(pack.id)}>Remove</button>
        ) : (
          <button onClick={() => downloadPack(pack.id)}>↓ Download</button>
        )}
      </div>
    </div>
  );
};

export default OfflinePackCard;
