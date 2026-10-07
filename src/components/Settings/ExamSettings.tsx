import React, { useState } from "react";
import { useUserStore } from "../../Store/useUserStore";
import { useExamCountdown } from "../../hooks/useExamCountdown";
import Button from "../ui/Button";
import { cn } from "../../lib/utils/utils";
import { Section, Field } from "./Shared";
import { inputCls } from "./SharedUtils";
import { Calendar, Clock } from "lucide-react";
import { truncateInput } from "../../lib/validation";

const TARGET_SCORES = [
  {
    range: "320+",
    label: "Elite",
    sub: "Top 1% nationwide",
    color: "var(--color-brand)",
  },
  {
    range: "280–319",
    label: "Excellent",
    sub: "Competitive for all Unis",
    color: "var(--color-success)",
  },
  {
    range: "250–279",
    label: "Strong",
    sub: "Target for State/Federal",
    color: "var(--color-warn)",
  },
  {
    range: "200–249",
    label: "Target",
    sub: "Standard Entry Level",
    color: "var(--color-danger)",
  },
];

const ExamSettings: React.FC = () => {
  const { targetScore, examDate, updateExamSettings } = useUserStore();

  // Hardcode exam year to 2027
  const EXAM_YEAR = "2027";

  // daysLeft is COMPUTED — never read from store
  const { daysLeft, formattedDate, isUpdating } = useExamCountdown();

  // Local form state
  const [form, setForm] = useState({
    targetScore,
    examYear: EXAM_YEAR,
    examDate,
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if form has unsaved changes
  const isDirty =
    form.targetScore !== targetScore || form.examDate !== examDate;

  const handleSave = async () => {
    setSaving(true);
    await updateExamSettings(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Colour the countdown based on urgency
  const cdColor =
    daysLeft < 0
      ? "var(--textDim)"
      : daysLeft === 0
        ? "var(--color-warn)"
        : daysLeft <= 7
          ? "var(--color-danger)"
          : daysLeft <= 30
            ? "var(--color-warn)"
            : "var(--color-brand)";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Live countdown banner ─────────────────────── */}
      <div className="bg-bgCard border-borderMuted rounded-brand-lg overflow-hidden border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${cdColor} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${cdColor} 30%, transparent)`,
              }}
            >
              <Clock className="h-5 w-5" style={{ color: cdColor }} />
            </div>
            <div className="min-w-0">
              <p className="text-textMain text-sm font-semibold">
                JAMB {form.examYear} Exam
              </p>
              <div className="text-textDim mt-0.5 flex items-center gap-1.5 text-[11px]">
                <Calendar className="h-3 w-3 shrink-0" />
                {/* Shows live formattedDate from the hook — updates when form saves */}
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Big countdown number */}
          <div className="shrink-0 text-right">
            {isUpdating ? (
              <p className="font-display text-textDim animate-pulse text-2xl font-black">
                …
              </p>
            ) : daysLeft < 0 ? (
              <p className="text-textDim text-sm">No date set</p>
            ) : daysLeft === 0 ? (
              <p
                className="font-display text-lg font-black"
                style={{ color: cdColor }}
              >
                Today!
              </p>
            ) : (
              <div>
                <p
                  className="font-display text-3xl leading-none font-black tracking-tighter"
                  style={{ color: cdColor }}
                >
                  {daysLeft}
                </p>
                <p className="text-textDim mt-0.5 text-[10px] tracking-widest uppercase">
                  days left
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Urgency bar at bottom of banner */}
        {daysLeft > 0 && (
          <div className="bg-bgSurface h-1 w-full">
            <div
              className="h-full transition-all duration-700"
              style={{
                // Fill shrinks as days pass — assumes ~365 day prep window
                width: `${Math.min(100, Math.max(2, (daysLeft / 365) * 100))}%`,
                background: cdColor,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Exam date ─────────────────────────────────── */}
      <Section title="Exam date">
        <Field>
          <input
            type="text"
            value={form.examDate}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                examDate: truncateInput(e.target.value, 20),
              }))
            }
            placeholder="e.g. Apr 27"
            className={inputCls(false)}
          />
          <p className="text-textDim mt-1.5 text-[11px] leading-relaxed">
            Format: <span className="text-textMain font-mono">Mon DD</span> —
            e.g. <span className="text-textMain font-mono">Apr 27</span>,{" "}
            <span className="text-textMain font-mono">Jun 14</span>. The
            countdown updates live when you save.
          </p>
        </Field>
      </Section>

      {/* ── Target score ──────────────────────────────── */}
      <Section title="Target score">
        <div className="flex flex-col gap-2">
          {TARGET_SCORES.map((t) => {
            const isSelected = form.targetScore === t.range;
            return (
              <button
                key={t.range}
                onClick={() => setForm((p) => ({ ...p, targetScore: t.range }))}
                className={cn(
                  "rounded-brand w-full border px-4 py-3.5 text-left transition-all",
                  isSelected
                    ? "bg-brand/10 border-brand"
                    : "bg-bgSurface border-borderMuted hover:border-white/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className="font-display text-lg leading-none font-bold"
                      style={{ color: t.color }}
                    >
                      {t.range}
                    </span>
                    <span className="text-textDim ml-2 text-xs font-semibold tracking-wide uppercase">
                      {t.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-textDim hidden text-[11px] sm:block">
                      {t.sub}
                    </span>
                    {isSelected && (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                        style={{ background: t.color }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Actions ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button
          variant={saved ? "success" : "primary"}
          size="md"
          disabled={(!isDirty && !saved) || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save changes"}
        </Button>
        {isDirty && (
          <button
            className="text-textDim hover:text-textMain text-sm transition-colors"
            onClick={() =>
              setForm({ targetScore, examYear: EXAM_YEAR, examDate })
            }
          >
            Discard
          </button>
        )}
      </div>
    </div>
  );
};

export default ExamSettings;
