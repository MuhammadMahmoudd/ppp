import * as React from "react";
import {
  seedApplicants,
  seedMatches,
  seedMentors,
  seedOpportunities,
  type Applicant,
  type CaseStatus,
  type Match,
  type Mentor,
  type Opportunity,
} from "./mockData";

export type Role = "applicant" | "admin" | "mentor";
export type Lang = "en" | "ku";

interface StoreState {
  role: Role;
  setRole: (r: Role) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  activeMentorId: string;
  setActiveMentorId: (id: string) => void;

  applicants: Applicant[];
  opportunities: Opportunity[];
  matches: Match[];
  mentors: Mentor[];

  addApplicant: (a: Applicant) => void;
  updateApplicantStatus: (id: string, status: CaseStatus) => void;
  assignMentor: (applicantId: string, mentorId: string | undefined) => void;
  setMatchDecision: (applicantId: string, opportunityId: string, decision: "approved" | "rejected" | null) => void;
  setMatchNote: (applicantId: string, opportunityId: string, note: string) => void;
  addOpportunity: (o: Opportunity) => void;
}

const StoreCtx = React.createContext<StoreState | null>(null);

const LS_KEY = "ynk-proto-v1";

function loadFromStorage(): Partial<StoreState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [role, setRole] = React.useState<Role>("applicant");
  const [lang, setLang] = React.useState<Lang>("en");
  const [activeMentorId, setActiveMentorId] = React.useState<string>(seedMentors[0].id);
  const [applicants, setApplicants] = React.useState<Applicant[]>(seedApplicants);
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(seedOpportunities);
  const [matches, setMatches] = React.useState<Match[]>(seedMatches);
  const [mentors] = React.useState<Mentor[]>(seedMentors);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  React.useEffect(() => {
    const persisted = loadFromStorage();
    if (persisted) {
      if (persisted.role) setRole(persisted.role as Role);
      if (persisted.lang) setLang(persisted.lang as Lang);
      if (persisted.activeMentorId) setActiveMentorId(persisted.activeMentorId as string);
      if (persisted.applicants) setApplicants(persisted.applicants as Applicant[]);
      if (persisted.opportunities) setOpportunities(persisted.opportunities as Opportunity[]);
      if (persisted.matches) setMatches(persisted.matches as Match[]);
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({ role, lang, activeMentorId, applicants, opportunities, matches }),
    );
  }, [hydrated, role, lang, activeMentorId, applicants, opportunities, matches]);

  const addApplicant = React.useCallback((a: Applicant) => {
    setApplicants((prev) => [a, ...prev]);
    // seed matches for the new applicant
    import("./mockData").then(({ generateSeedMatches }) => {
      setMatches((prev) => [...prev, ...generateSeedMatches([a], opportunities)]);
    });
  }, [opportunities]);

  const updateApplicantStatus = React.useCallback((id: string, status: CaseStatus) => {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const assignMentor = React.useCallback((applicantId: string, mentorId: string | undefined) => {
    setApplicants((prev) =>
      prev.map((a) =>
        a.id === applicantId
          ? { ...a, assignedMentorId: mentorId, status: mentorId ? (a.status === "New" || a.status === "Triage" ? "Assigned" : a.status) : a.status }
          : a,
      ),
    );
  }, []);

  const setMatchDecision = React.useCallback(
    (applicantId: string, opportunityId: string, decision: "approved" | "rejected" | null) => {
      setMatches((prev) =>
        prev.map((m) =>
          m.applicantId === applicantId && m.opportunityId === opportunityId
            ? { ...m, mentorDecision: decision }
            : m,
        ),
      );
    },
    [],
  );

  const setMatchNote = React.useCallback((applicantId: string, opportunityId: string, note: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.applicantId === applicantId && m.opportunityId === opportunityId ? { ...m, mentorNote: note } : m,
      ),
    );
  }, []);

  const addOpportunity = React.useCallback((o: Opportunity) => {
    setOpportunities((prev) => [o, ...prev]);
  }, []);

  const value: StoreState = {
    role,
    setRole,
    lang,
    setLang,
    activeMentorId,
    setActiveMentorId,
    applicants,
    opportunities,
    matches,
    mentors,
    addApplicant,
    updateApplicantStatus,
    assignMentor,
    setMatchDecision,
    setMatchNote,
    addOpportunity,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// tiny i18n dict — only the applicant form is meaningfully translated.
const DICT = {
  en: {
    "brand": "YNK Opportunities",
    "tagline": "Kurdish talent, matched to global opportunities.",
    "role.viewing": "Viewing as",
    "role.applicant": "Applicant",
    "role.admin": "Admin",
    "role.mentor": "Mentor",
    "nav.apply": "Apply",
    "nav.admin": "Admin",
    "nav.mentor": "Mentor",
    "lang.toggle": "کوردی",
    "form.step": "Step",
    "form.of": "of",
    "form.next": "Next",
    "form.back": "Back",
    "form.submit": "Submit application",
    "form.identity": "About you",
    "form.academic": "Academic background",
    "form.target": "Target programme",
    "form.language": "Languages",
    "form.experience": "Experience",
    "form.prefs": "Preferences",
    "form.funding": "Funding",
    "form.docs": "Documents",
    "form.done": "Application received",
    "form.doneBody": "Thanks — a mentor will review your case shortly.",
  },
  ku: {
    "brand": "دەرفەتەکانی YNK",
    "tagline": "بەهرەی کوردی، لەگەڵ دەرفەتە جیهانییەکان دەبەستێینەوە.",
    "role.viewing": "بینین وەکو",
    "role.applicant": "داواکار",
    "role.admin": "بەڕێوەبەر",
    "role.mentor": "ڕاوێژکار",
    "nav.apply": "داواکاری",
    "nav.admin": "بەڕێوەبەر",
    "nav.mentor": "ڕاوێژکار",
    "lang.toggle": "English",
    "form.step": "هەنگاو",
    "form.of": "لە",
    "form.next": "دواتر",
    "form.back": "گەڕانەوە",
    "form.submit": "ناردنی داواکاری",
    "form.identity": "دەربارەی تۆ",
    "form.academic": "پێشینەی زانستی",
    "form.target": "بەرنامەی ئامانج",
    "form.language": "زمانەکان",
    "form.experience": "ئەزموون",
    "form.prefs": "هەڵبژاردەکان",
    "form.funding": "دارایی",
    "form.docs": "بەڵگەنامەکان",
    "form.done": "داواکارییەکەت وەرگیرا",
    "form.doneBody": "سوپاس — ڕاوێژکارێک بەم زووانە دۆسیەکەت پێداچوونەوەی بۆ دەکات.",
  },
} as const;

export function useT() {
  const { lang } = useStore();
  return (k: keyof typeof DICT["en"]) => DICT[lang][k] ?? DICT.en[k] ?? k;
}
