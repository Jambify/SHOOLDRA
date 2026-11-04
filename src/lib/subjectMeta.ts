// src/lib/subjectMeta.ts
/**
 * Single source of truth for how a subject and subject combinations are
 * represented visually across every page (Settings, Quiz, Mock Exam, Past Questions).
 */
import {
  BookOpen,
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  TrendingUp,
  Landmark,
  BookMarked,
  ScrollText,
  Globe,
  Church,
  BookOpenCheck,
  ShoppingBag,
  Stethoscope,
  Cpu,
  Scale,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export interface SubjectCombo {
  id: string;
  label: string;
  subjects: string[];
  icon: LucideIcon;
}

export const SUBJECT_COMBOS: SubjectCombo[] = [
  {
    id: "medicine",
    label: "Medicine & Pharmacy",
    subjects: ["English", "Biology", "Chemistry", "Physics"],
    icon: Stethoscope,
  },
  {
    id: "engineering",
    label: "Engineering & Tech",
    subjects: ["English", "Mathematics", "Physics", "Chemistry"],
    icon: Cpu,
  },
  {
    id: "social-sci",
    label: "Social Sciences",
    subjects: ["English", "Mathematics", "Economics", "Government"],
    icon: TrendingUp,
  },
  {
    id: "law",
    label: "Law & Arts",
    subjects: ["English", "Literature", "Government", "CRS/IRS"],
    icon: Scale,
  },
  {
    id: "Commerce",
    label: "Commerce & Business",
    subjects: ["English", "Commerce", "Economics", "CRS/IRS"],
    icon: Briefcase,
  },
];

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  English: BookOpen,
  Mathematics: Calculator,
  Physics: Zap,
  Chemistry: FlaskConical,
  Biology: Dna,
  Economics: TrendingUp,
  Government: Landmark,
  Literature: BookMarked,
  History: ScrollText,
  Geography: Globe,
  CRS: Church,
  IRS: BookOpenCheck,
  Commerce: ShoppingBag,
};

export const SUBJECT_COLORS: Record<string, string> = {
  English: "var(--subject-english)",
  Mathematics: "var(--subject-mathematics)",
  Physics: "var(--subject-physics)",
  Chemistry: "var(--subject-chemistry)",
  Biology: "var(--subject-biology)",
  Economics: "var(--subject-economics)",
  Government: "var(--subject-government)",
  Literature: "var(--subject-literature)",
  History: "var(--subject-history)",
  Geography: "var(--subject-geography)",
  CRS: "var(--subject-crs)",
  IRS: "var(--subject-irs)",
  Commerce: "var(--subject-commerce)",
};

const DEFAULT_SUBJECT_ICON = BookOpen;
const DEFAULT_SUBJECT_COLOR = "var(--color-brand)";

export const getSubjectIcon = (subject: string): LucideIcon =>
  SUBJECT_ICONS[subject] ?? DEFAULT_SUBJECT_ICON;

export const getSubjectColor = (subject: string): string =>
  SUBJECT_COLORS[subject] ?? DEFAULT_SUBJECT_COLOR;

