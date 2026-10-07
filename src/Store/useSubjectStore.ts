// src/Store/useSubjectStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useUserStore } from "./useUserStore";
import { getDetailedTopicStats } from "../Services/PerformanceService";
import type { Subject } from "../Types/subject";
import { getSubjectColor } from "../lib/subjectMeta";

interface SubjectState {
  subjects: Subject[];
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
  hasFetched: boolean;
  reset: () => void; // ← ADD THIS

  // Actions
  loadSubjects: (force?: boolean) => Promise<void>;
  updateSubject: (
    id: string,
    quizCorrect: number,
    quizTotal: number,
  ) => Promise<void>;
  initialize: () => Promise<void>;
}

// Moved above ALL_SUBJECTS_MASTER so the array below can be typed with it.
interface MasterSubjectEntry {
  id: string;
  name: string;
  total: number;
  topics?: string[];
  icon?: string;
}

// Complete master list of all possible subjects with their details
export const ALL_SUBJECTS_MASTER: MasterSubjectEntry[] = [
  {
    id: "eng",
    name: "English",
    total: 420,
    topics: [
      "Comprehension",
      "Lexis and Structure",
      "Oral English",
      "Sentence Interpretation",
      "Figures of Speech",
    ],
  },
  {
    id: "math",
    name: "Mathematics",
    total: 380,
    topics: [
      "Number Bases",
      "Fractions, Decimals and Percentages",
      "Indices, Logarithms and Surds",
      "Sets",
      "Polynomials",
      "Variation",
      "Inequalities",
      "Progressions",
      "Binary Operations",
      "Matrices and Determinants",
      "Euclidean Geometry",
      "Mensuration",
      "Loci",
      "Coordinate Geometry",
      "Trigonometry",
      "Differentiation",
      "Integration",
      "Statistics",
      "Probability",
    ],
  },
  {
    id: "phy",
    name: "Physics",
    total: 310,
    topics: [
      "Mechanics",
      "Thermal Physics",
      "Optics",
      "Electricity and Magnetism",
      "Waves",
      "Modern Physics",
    ],
  },
  {
    id: "chem",
    name: "Chemistry",
    total: 340,
    topics: [
      "Rates of Chemical Reactions",
      "Industrial Chemistry",
      "Organic Chemistry",
      "Gases & Gas Laws",
      "Chemical Bonding",
      "Thermodynamics",
      "Inorganic Chemistry",
      "Redox Reactions",
      "States of Matter & Matter Properties",
      "Atomic Structure",
      "Acids, Bases, & Salts",
      "Electrolysis",
      "Water Chemistry",
      "Environmental Chemistry",
    ],
  },
  {
    id: "bio",
    name: "Biology",
    total: 290,
    topics: [
      "Adaptation",
      "Cell Biology",
      "Genetics",
      "Ecology",
      "Evolution",
      "Circulatory System",
      "Plant Biology",
      "Public Health",
    ],
  },
  {
    id: "econ",
    name: "Economics",
    total: 270,
    topics: [
      "Introduction to Economics (Scarcity & Choice)",
      "Demand and Supply (Elasticity & Equilibrium)",
      "Production Theory (PPF & Factors)",
      "Macroeconomics (National Income & Growth)",
      "Public Finance, Money & Banking",
      "Market Structures (Competition & Monopoly)",
      "International Trade & Organizations",
      "Agricultural Economics",
      "Statistics (Central Tendency & Variance)",
    ],
  },
  {
    id: "gov", name: "Government", total: 300, topics: [
      "Political Science & Governance - Systems of Government",
      "Political Science & Governance - Political Ideologies",
      "Political Science & Governance - Public Opinion",
      "Nigerian Government & History - Pre-colonial Administration",
      "Nigerian Government & History - Colonial History",
      "Nigerian Government & History - Post-independence Political History",
      "Nigerian Government & History - Nigerian Federalism",
      "Constitutions & Legal Framework - Constitutional Development",
      "Constitutions & Legal Framework - Rule of Law",
      "International Relations & Organizations - Foreign Policy",
      "International Relations & Organizations - International Organizations",
      "Public Administration & Elections - Civil Service",
      "Public Administration & Elections - Public Corporations",
      "Public Administration & Elections - Electoral Processes",
      "Arms of Government - Executive, Legislative, and Judiciary",
      "Arms of Government - Pressure Groups"
    ]
  },
  { id: "lit", name: "Literature in English", total: 300 },
  { id: "crs", name: "CRS", total: 250 },
  { id: "irs", name: "IRS", total: 250 },
  {
    id: "com",
    name: "Commerce",
    total: 300,
    topics: [
      "Business Organization",
      "Finance",
      "International Trade",
      "Business Documents",
      "Production",
      "Business Law",
      "Marketing",
      "Banking",
      "Distribution"
    ]
  },
];

// Maps short subject ID to full name (for database enum)
const SHORT_ID_TO_FULL_NAME: Record<string, string> = {
  eng: "English",
  math: "Mathematics",
  phy: "Physics",
  chem: "Chemistry",
  bio: "Biology",
  econ: "Economics",
  gov: "Government",
  lit: "Literature in English",
  crs: "CRS",
  irs: "IRS",
  com: "Commerce",
};

// Maps full subject name (from database enum) back to short ID
const FULL_NAME_TO_SHORT_ID: Record<string, string> = {
  English: "eng",
  Mathematics: "math",
  Physics: "phy",
  Chemistry: "chem",
  Biology: "bio",
  Economics: "econ",
  Government: "gov",
  "Literature in English": "lit",
  CRS: "crs",
  IRS: "irs",
  Commerce: "com",
};

// Map subject combo ID to list of subject names (matches your onboarding)
export const SUBJECT_COMBO_MAP: Record<string, string[]> = {
  medicine: ["English", "Biology", "Chemistry", "Physics"],
  engineering: ["English", "Mathematics", "Physics", "Chemistry"],
  "social-sci": ["English", "Mathematics", "Economics", "Government"],
  law: ["English", "Literature in English", "Government", "CRS"],
  art: ["English", "Literature in English", "Government", "CRS"],
  commerce: ["English", "Commerce", "Economics", "CRS"],
  Commerce: ["English", "Commerce", "Economics", "CRS"],
};

// Map subject name to master subject object
export const getSubjectFromName = (name: string): MasterSubjectEntry | undefined => {
  const nameMap: Record<string, MasterSubjectEntry | undefined> = {
    English: ALL_SUBJECTS_MASTER.find((s) => s.name === "English"),
    Mathematics: ALL_SUBJECTS_MASTER.find((s) => s.name === "Mathematics"),
    Physics: ALL_SUBJECTS_MASTER.find((s) => s.name === "Physics"),
    Chemistry: ALL_SUBJECTS_MASTER.find((s) => s.name === "Chemistry"),
    Biology: ALL_SUBJECTS_MASTER.find((s) => s.name === "Biology"),
    Economics: ALL_SUBJECTS_MASTER.find((s) => s.name === "Economics"),
    Government: ALL_SUBJECTS_MASTER.find((s) => s.name === "Government"),
    "Literature in English": ALL_SUBJECTS_MASTER.find((s) => s.name === "Literature in English"),
    CRS: ALL_SUBJECTS_MASTER.find((s) => s.name === "CRS"),
    IRS: ALL_SUBJECTS_MASTER.find((s) => s.name === "IRS"),
    Commerce: ALL_SUBJECTS_MASTER.find((s) => s.name === "Commerce"),
  };
  return nameMap[name];
};

// Calculate national rank based on accuracy
const calculateRank = (accuracy: number): number => {
  if (accuracy >= 90) return 5;
  if (accuracy >= 80) return 12;
  if (accuracy >= 70) return 25;
  if (accuracy >= 60) return 45;
  if (accuracy >= 50) return 60;
  return 75;
};

// Get user's selected subjects based on their onboarding subject combo
const getUserSelectedSubjects = (): string[] => {
  const subjectCombo = useUserStore.getState().subjectCombo;
  let subjects: string[];
  if (Array.isArray(subjectCombo)) {
    subjects = subjectCombo;
  } else {
    subjects = SUBJECT_COMBO_MAP[subjectCombo] || SUBJECT_COMBO_MAP["engineering"];
  }
  console.log(
    "🔵 User selected subjects:",
    subjects,
    "from combo:",
    subjectCombo,
  );
  return subjects;
};

// Fetch user's subject progress (only selected subjects)
const fetchUserSubjects = async (): Promise<Subject[]> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get user's selected subjects from their onboarding choice
  const selectedSubjectNames = getUserSelectedSubjects();

  // Get the master data for only selected subjects
  const selectedSubjectsMaster = selectedSubjectNames
    .map((name) => getSubjectFromName(name))
    .filter((s) => s !== undefined);

  // Fetch existing progress and real topic stats
  const [{ data: existingProgress, error }, realTopicStats] = await Promise.all([
    supabase.from("subject_accuracy").select("*").eq("user_id", user.id),
    getDetailedTopicStats(),
  ]);

  if (error) throw error;

  // Create a map of existing progress, using FULL_NAME_TO_SHORT_ID to map back
  const progressMap = new Map<string, { total_correct: number; total_attempted: number }>();
  existingProgress?.forEach((p) => {
    const shortId = FULL_NAME_TO_SHORT_ID[p.subject];
    if (shortId) progressMap.set(shortId, p);
  });

  // Build subjects only for selected ones
  const subjects: Subject[] = selectedSubjectsMaster.map((master) => {
    const progress = progressMap.get(master.id);
    const totalCorrect = progress?.total_correct || 0;
    const totalAttempted = progress?.total_attempted || 0;
    const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    const rank = calculateRank(accuracy);

    // Collect weakest topic (only from real database data)
    let weakTopics: string[] = [];
    const subjectTopicStats = realTopicStats
      .filter((t) => t.subject === master.name)
      .sort((a, b) => a.accuracy - b.accuracy); // Sort weakest first

    if (subjectTopicStats.length > 0) {
      weakTopics = [subjectTopicStats[0].name];
    }

    return {
      id: master.id,
      name: master.name,
      // No subject in ALL_SUBJECTS_MASTER currently sets an icon, so master.icon
      // is undefined here — fall back to a default so this matches Subject["icon"]
      // (a required string), rather than widening the Subject type instead.
      icon: master.icon ?? "📘",
      color: getSubjectColor(master.name),
      accuracy: accuracy,
      completed: 0, // Removed questions done, as per user request
      total: master.total,
      rank: rank,
      weakTopics: weakTopics,
      topics: master.topics || [],
    };
  });

  return subjects;
};

// Initialize subject progress for a new user (only selected subjects)
// Will NOT reset progress if subject already exists!
const initializeUserSubjects = async (): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get user's selected subjects
  const selectedSubjectNames = getUserSelectedSubjects();
  const selectedSubjectsMaster = selectedSubjectNames
    .map((name) => getSubjectFromName(name))
    .filter((s) => s !== undefined);

  console.log("🔵 Initializing subjects for user:", selectedSubjectNames);

  for (const master of selectedSubjectsMaster) {
    const fullName = SHORT_ID_TO_FULL_NAME[master.id];
    if (!fullName) continue;

    // Only insert if not already exists
    const { data: existing } = await supabase
      .from("subject_accuracy")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject", fullName)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("subject_accuracy").insert(
        {
          user_id: user.id,
          subject: fullName,
          total_correct: 0,
          total_attempted: 0,
        },
      );

      if (error) console.error(`Error initializing ${master.name}:`, error);
    }
  }
};

// Update subject progress in database (using new subject_accuracy table)
const updateSubjectProgressInDB = async (
  subjectId: string,
  quizCorrect: number,
  quizTotal: number,
): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const master = ALL_SUBJECTS_MASTER.find((s) => s.id === subjectId);
  if (!master) throw new Error("Subject not found");
  const fullName = SHORT_ID_TO_FULL_NAME[subjectId];
  if (!fullName) throw new Error("Subject not found in mapping");

  // Fetch existing progress first
  const { data: existing } = await supabase
    .from("subject_accuracy")
    .select("*")
    .eq("user_id", user.id)
    .eq("subject", fullName)
    .maybeSingle();

  const finalCorrect = (existing?.total_correct || 0) + quizCorrect;
  const finalAttempted = (existing?.total_attempted || 0) + quizTotal;

  const { error } = await supabase.from("subject_accuracy").upsert(
    {
      user_id: user.id,
      subject: fullName,
      total_correct: finalCorrect,
      total_attempted: finalAttempted,
    },
    {
      onConflict: "user_id,subject",
    },
  );

  if (error) throw error;
};

export const useSubjectStore = create<SubjectState>()((set, get) => ({
  subjects: [],
  isLoading: true,
  error: null,
  isInitialized: false,
  hasFetched: false,

  loadSubjects: async (force = false) => {
    if (get().isInitialized && !force) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const subjects = await fetchUserSubjects();
      set({ subjects, isLoading: false, isInitialized: true, hasFetched: true });
    } catch (error) {
      console.error("Failed to load subjects:", error);
      set({
        error: "We couldn't load your subjects right now. Please check your internet connection and try again.",
        isLoading: false
      });
    }
  },

  updateSubject: async (id: string, quizCorrect: number, quizTotal: number) => {
    try {
      await updateSubjectProgressInDB(id, quizCorrect, quizTotal);

      // Reload subjects to get the updated cumulative numbers
      await get().loadSubjects(true);
    } catch (error) {
      console.error("Failed to update subject:", error);
    }
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      await initializeUserSubjects();
      await get().loadSubjects(true);
    } catch (error) {
      console.error("Failed to initialize subjects:", error);
      set({
        error: "We couldn't load your subjects right now. Please check your internet connection and try again.",
        isLoading: false
      });
    }
  },
  reset: () => set({ subjects: [], isLoading: true, error: null, isInitialized: false, hasFetched: false }),
}));