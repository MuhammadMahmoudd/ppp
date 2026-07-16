// Seed data + types for the YNK Opportunities prototype.
// This is a demo store — no DB, no auth, no file storage.

export type CaseStatus =
  | "New"
  | "Triage"
  | "Assigned"
  | "In Progress"
  | "Ready for Delivery"
  | "Delivered"
  | "Follow-up";

export const CASE_STATUSES: CaseStatus[] = [
  "New",
  "Triage",
  "Assigned",
  "In Progress",
  "Ready for Delivery",
  "Delivered",
  "Follow-up",
];

export type DegreeLevel = "Bachelor" | "Master" | "PhD" | "Diploma" | "Short course";
export type FundingType =
  | "Full scholarship"
  | "Partial scholarship"
  | "Grant"
  | "Fellowship"
  | "Exchange"
  | "Internship";

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  gender: "F" | "M" | "Other";
  dateOfBirth: string; // ISO
  degreeLevel: DegreeLevel;
  field: string;
  university: string;
  gpa: number; // /4
  targetLevel: DegreeLevel;
  targetField: string;
  targetCountries: string[];
  languages: { name: string; level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" }[];
  ielts?: number;
  experience: string[]; // checkboxes
  fundingPreference: FundingType[];
  budgetMax?: number;
  notes?: string;
  documents: { name: string; kind: string }[];
  createdAt: string; // ISO
  status: CaseStatus;
  assignedMentorId?: string;
}

export interface Opportunity {
  id: string;
  name: string;
  provider: string;
  country: string;
  field: string;
  level: DegreeLevel;
  fundingType: FundingType;
  deadline: string; // ISO
  minGpa?: number;
  languageRequirement?: string;
  url: string;
  summary: string;
}

export interface Match {
  applicantId: string;
  opportunityId: string;
  score: number; // 0-100
  reasons: string[];
  mentorDecision?: "approved" | "rejected" | null;
  mentorNote?: string;
}

export interface Mentor {
  id: string;
  name: string;
  focus: string;
  avatar: string;
}

// ---------- SEED ----------

export const seedMentors: Mentor[] = [
  { id: "m_lana", name: "Lana Hussein", focus: "EU scholarships & STEM", avatar: "LH" },
  { id: "m_dilan", name: "Dilan Ahmad", focus: "MENA fellowships & policy", avatar: "DA" },
];

const iso = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
};

export const seedOpportunities: Opportunity[] = [
  {
    id: "op_chevening",
    name: "Chevening Scholarship",
    provider: "UK FCDO",
    country: "United Kingdom",
    field: "Any",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(60),
    minGpa: 3.0,
    languageRequirement: "IELTS 6.5",
    url: "https://www.chevening.org",
    summary: "Fully-funded UK Master's for future leaders with 2+ years of work experience.",
  },
  {
    id: "op_daad_epos",
    name: "DAAD EPOS",
    provider: "DAAD (Germany)",
    country: "Germany",
    field: "Development-related",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(90),
    minGpa: 3.0,
    languageRequirement: "IELTS 6.0",
    url: "https://www.daad.de",
    summary: "Postgraduate courses in Germany for professionals from developing countries.",
  },
  {
    id: "op_orange_corners",
    name: "Orange Corners Innovation Fund",
    provider: "Netherlands MFA",
    country: "Iraq / Netherlands",
    field: "Entrepreneurship",
    level: "Short course",
    fundingType: "Grant",
    deadline: iso(45),
    url: "https://www.orangecorners.com",
    summary: "Grants for early-stage entrepreneurs in emerging markets.",
  },
  {
    id: "op_erasmus_ma",
    name: "Erasmus Mundus Joint Master",
    provider: "European Commission",
    country: "EU (multi-country)",
    field: "Various",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(30),
    minGpa: 3.2,
    languageRequirement: "IELTS 6.5",
    url: "https://www.eacea.ec.europa.eu",
    summary: "Two-year integrated Master's across at least two European universities.",
  },
  {
    id: "op_fulbright",
    name: "Fulbright Foreign Student Program",
    provider: "US Department of State",
    country: "United States",
    field: "Any",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(120),
    minGpa: 3.3,
    languageRequirement: "TOEFL 90",
    url: "https://foreign.fulbrightonline.org",
    summary: "Graduate study in the US, all fields except clinical medicine.",
  },
  {
    id: "op_swedish_si",
    name: "Swedish Institute Scholarships",
    provider: "Swedish Institute",
    country: "Sweden",
    field: "Sustainability & Governance",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(75),
    minGpa: 3.0,
    languageRequirement: "IELTS 6.5",
    url: "https://si.se",
    summary: "Master's programmes in Sweden with a focus on sustainable development.",
  },
  {
    id: "op_aga_khan",
    name: "Aga Khan Foundation ISP",
    provider: "AKF",
    country: "Multi-country",
    field: "Any",
    level: "Master",
    fundingType: "Partial scholarship",
    deadline: iso(150),
    url: "https://the.akdn",
    summary: "50% loan, 50% grant for graduate study.",
  },
  {
    id: "op_tudelft_ep",
    name: "TU Delft Excellence Scholarship",
    provider: "TU Delft",
    country: "Netherlands",
    field: "Engineering",
    level: "Master",
    fundingType: "Partial scholarship",
    deadline: iso(40),
    minGpa: 3.5,
    languageRequirement: "IELTS 6.5",
    url: "https://www.tudelft.nl",
    summary: "Partial funding for high-achieving international Master's students.",
  },
  {
    id: "op_kaust",
    name: "KAUST Fellowship",
    provider: "KAUST",
    country: "Saudi Arabia",
    field: "STEM",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(180),
    minGpa: 3.2,
    languageRequirement: "IELTS 6.0",
    url: "https://www.kaust.edu.sa",
    summary: "Full tuition, stipend, and housing for STEM graduate study.",
  },
  {
    id: "op_yenching",
    name: "Yenching Academy Fellowship",
    provider: "Peking University",
    country: "China",
    field: "China Studies",
    level: "Master",
    fundingType: "Fellowship",
    deadline: iso(55),
    minGpa: 3.4,
    url: "https://yenchingacademy.pku.edu.cn",
    summary: "Interdisciplinary Master's in China Studies at Peking University.",
  },
  {
    id: "op_mext",
    name: "MEXT Scholarship",
    provider: "Japanese Government",
    country: "Japan",
    field: "Any",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(70),
    minGpa: 3.0,
    url: "https://www.mext.go.jp",
    summary: "Fully-funded graduate study in Japan.",
  },
  {
    id: "op_britishcouncil_women",
    name: "British Council Women in STEM",
    provider: "British Council",
    country: "United Kingdom",
    field: "STEM",
    level: "Master",
    fundingType: "Full scholarship",
    deadline: iso(35),
    minGpa: 3.0,
    languageRequirement: "IELTS 6.5",
    url: "https://www.britishcouncil.org",
    summary: "Fully funded UK Master's for women in STEM disciplines.",
  },
  {
    id: "op_gatesnigeria",
    name: "Rotary Peace Fellowship",
    provider: "Rotary Foundation",
    country: "Multi-country",
    field: "Peace & Conflict",
    level: "Master",
    fundingType: "Fellowship",
    deadline: iso(100),
    url: "https://www.rotary.org",
    summary: "Master's or certificate at one of Rotary's Peace Centers worldwide.",
  },
  {
    id: "op_agfund",
    name: "AGFUND Youth Innovation Grant",
    provider: "AGFUND",
    country: "MENA",
    field: "Social innovation",
    level: "Short course",
    fundingType: "Grant",
    deadline: iso(25),
    url: "https://www.agfund.org",
    summary: "Seed funding for youth-led social ventures in the Arab world.",
  },
  {
    id: "op_iaea_intern",
    name: "IAEA Marie Skłodowska-Curie Fellowship",
    provider: "IAEA",
    country: "Austria",
    field: "Nuclear science",
    level: "Master",
    fundingType: "Fellowship",
    deadline: iso(110),
    minGpa: 3.0,
    url: "https://www.iaea.org",
    summary: "Fellowship for women pursuing Master's in nuclear-related fields.",
  },
  {
    id: "op_kais_summer",
    name: "Oxford Global Leadership Summer",
    provider: "Oxford University",
    country: "United Kingdom",
    field: "Leadership",
    level: "Short course",
    fundingType: "Partial scholarship",
    deadline: iso(20),
    url: "https://www.ox.ac.uk",
    summary: "Two-week residential leadership programme with partial funding.",
  },
  {
    id: "op_unesco_intern",
    name: "UNESCO Internship Programme",
    provider: "UNESCO",
    country: "France",
    field: "Policy",
    level: "Diploma",
    fundingType: "Internship",
    deadline: iso(15),
    url: "https://www.unesco.org",
    summary: "Paid internship at UNESCO HQ or field offices.",
  },
];

export const seedApplicants: Applicant[] = [
  {
    id: "a_shan",
    fullName: "Shan Ibrahim",
    email: "shan.ibrahim@example.com",
    phone: "+964 750 111 2222",
    country: "Iraq",
    city: "Erbil",
    gender: "F",
    dateOfBirth: "2000-04-12",
    degreeLevel: "Bachelor",
    field: "Computer Science",
    university: "Salahaddin University",
    gpa: 3.6,
    targetLevel: "Master",
    targetField: "Data Science",
    targetCountries: ["Germany", "Netherlands", "United Kingdom"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "Arabic", level: "C1" },
      { name: "English", level: "C1" },
    ],
    ielts: 7.0,
    experience: ["Research assistant", "Volunteer teaching", "Hackathon winner"],
    fundingPreference: ["Full scholarship", "Fellowship"],
    documents: [{ name: "transcript.pdf", kind: "Transcript" }, { name: "cv.pdf", kind: "CV" }],
    createdAt: iso(-3),
    status: "Assigned",
    assignedMentorId: "m_lana",
  },
  {
    id: "a_hemn",
    fullName: "Hemn Karim",
    email: "hemn.k@example.com",
    phone: "+964 770 333 4444",
    country: "Iraq",
    city: "Sulaymaniyah",
    gender: "M",
    dateOfBirth: "1998-08-30",
    degreeLevel: "Master",
    field: "Public Policy",
    university: "American University of Iraq",
    gpa: 3.8,
    targetLevel: "PhD",
    targetField: "Political Economy",
    targetCountries: ["United States", "United Kingdom"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "C2" },
    ],
    ielts: 8.0,
    experience: ["Published research", "Policy internship", "Debate champion"],
    fundingPreference: ["Full scholarship", "Fellowship"],
    documents: [{ name: "writing_sample.pdf", kind: "Writing sample" }],
    createdAt: iso(-6),
    status: "In Progress",
    assignedMentorId: "m_dilan",
  },
  {
    id: "a_avin",
    fullName: "Avin Rasheed",
    email: "avin.rasheed@example.com",
    phone: "+964 751 555 6666",
    country: "Iraq",
    city: "Duhok",
    gender: "F",
    dateOfBirth: "2001-11-05",
    degreeLevel: "Bachelor",
    field: "Mechanical Engineering",
    university: "University of Duhok",
    gpa: 3.4,
    targetLevel: "Master",
    targetField: "Renewable Energy",
    targetCountries: ["Sweden", "Germany"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "B2" },
    ],
    ielts: 6.5,
    experience: ["Solar project lead", "Internship at NGO"],
    fundingPreference: ["Full scholarship"],
    documents: [{ name: "cv.pdf", kind: "CV" }],
    createdAt: iso(-1),
    status: "Triage",
  },
  {
    id: "a_rebin",
    fullName: "Rebin Salih",
    email: "rebin.s@example.com",
    phone: "+964 750 777 8888",
    country: "Iraq",
    city: "Erbil",
    gender: "M",
    dateOfBirth: "1999-02-18",
    degreeLevel: "Bachelor",
    field: "Business Administration",
    university: "Cihan University",
    gpa: 3.1,
    targetLevel: "Master",
    targetField: "Entrepreneurship",
    targetCountries: ["Netherlands", "United Kingdom"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "B2" },
    ],
    experience: ["Founded student startup"],
    fundingPreference: ["Grant", "Partial scholarship"],
    documents: [],
    createdAt: iso(0),
    status: "New",
  },
  {
    id: "a_narin",
    fullName: "Narin Hama",
    email: "narin.hama@example.com",
    phone: "+964 771 999 0000",
    country: "Iraq",
    city: "Sulaymaniyah",
    gender: "F",
    dateOfBirth: "2002-06-22",
    degreeLevel: "Bachelor",
    field: "Physics",
    university: "University of Sulaimani",
    gpa: 3.7,
    targetLevel: "Master",
    targetField: "Nuclear Science",
    targetCountries: ["Austria", "Germany"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "C1" },
    ],
    ielts: 7.5,
    experience: ["Physics olympiad", "Research assistant"],
    fundingPreference: ["Fellowship", "Full scholarship"],
    documents: [{ name: "transcript.pdf", kind: "Transcript" }],
    createdAt: iso(-2),
    status: "Ready for Delivery",
    assignedMentorId: "m_lana",
  },
  {
    id: "a_karwan",
    fullName: "Karwan Jalal",
    email: "karwan.j@example.com",
    phone: "+964 750 222 3333",
    country: "Iraq",
    city: "Kirkuk",
    gender: "M",
    dateOfBirth: "1997-09-14",
    degreeLevel: "Master",
    field: "Architecture",
    university: "TU Berlin",
    gpa: 3.5,
    targetLevel: "PhD",
    targetField: "Urban Planning",
    targetCountries: ["Germany", "Sweden"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "C1" },
      { name: "German", level: "B2" },
    ],
    ielts: 7.0,
    experience: ["Published in journal", "Taught studio"],
    fundingPreference: ["Fellowship"],
    documents: [{ name: "portfolio.pdf", kind: "Portfolio" }],
    createdAt: iso(-10),
    status: "Delivered",
    assignedMentorId: "m_dilan",
  },
  {
    id: "a_zhino",
    fullName: "Zhino Farhad",
    email: "zhino.f@example.com",
    phone: "+964 751 444 5555",
    country: "Iraq",
    city: "Halabja",
    gender: "F",
    dateOfBirth: "2003-01-08",
    degreeLevel: "Diploma",
    field: "Digital Media",
    university: "Halabja Institute",
    gpa: 3.3,
    targetLevel: "Bachelor",
    targetField: "Communications",
    targetCountries: ["Turkey", "Netherlands"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "B1" },
    ],
    experience: ["Freelance videographer"],
    fundingPreference: ["Partial scholarship", "Grant"],
    documents: [],
    createdAt: iso(-4),
    status: "New",
  },
  {
    id: "a_soran",
    fullName: "Soran Baker",
    email: "soran.b@example.com",
    phone: "+964 770 666 7777",
    country: "Iraq",
    city: "Erbil",
    gender: "M",
    dateOfBirth: "2000-12-01",
    degreeLevel: "Bachelor",
    field: "Medicine",
    university: "Hawler Medical University",
    gpa: 3.9,
    targetLevel: "Master",
    targetField: "Public Health",
    targetCountries: ["United Kingdom", "United States"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "C1" },
    ],
    ielts: 7.5,
    experience: ["Hospital volunteer", "Research paper"],
    fundingPreference: ["Full scholarship"],
    documents: [{ name: "cv.pdf", kind: "CV" }, { name: "transcript.pdf", kind: "Transcript" }],
    createdAt: iso(-8),
    status: "Follow-up",
    assignedMentorId: "m_lana",
  },
  {
    id: "a_lava",
    fullName: "Lava Muhammad",
    email: "lava.m@example.com",
    phone: "+964 751 888 9999",
    country: "Iraq",
    city: "Erbil",
    gender: "F",
    dateOfBirth: "2001-07-19",
    degreeLevel: "Bachelor",
    field: "Law",
    university: "Salahaddin University",
    gpa: 3.5,
    targetLevel: "Master",
    targetField: "Human Rights Law",
    targetCountries: ["Sweden", "Netherlands", "United Kingdom"],
    languages: [
      { name: "Kurdish", level: "C2" },
      { name: "English", level: "C1" },
      { name: "Arabic", level: "C2" },
    ],
    ielts: 7.0,
    experience: ["Legal intern", "NGO volunteer"],
    fundingPreference: ["Full scholarship", "Fellowship"],
    documents: [{ name: "cv.pdf", kind: "CV" }],
    createdAt: iso(-5),
    status: "Assigned",
    assignedMentorId: "m_dilan",
  },
];

// Hand-rolled plausible matches (not the real scoring engine).
function scoreFor(a: Applicant, o: Opportunity): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 40 + Math.floor(Math.random() * 20);
  if (o.level === a.targetLevel) {
    score += 15;
    reasons.push(`Level matches (${o.level})`);
  }
  if (o.country && a.targetCountries.some((c) => o.country.includes(c))) {
    score += 15;
    reasons.push(`Country in preference list`);
  }
  if (a.fundingPreference.includes(o.fundingType)) {
    score += 10;
    reasons.push(`Funding type matches preference`);
  }
  if (!o.minGpa || a.gpa >= o.minGpa) {
    score += 5;
    reasons.push(`GPA meets minimum`);
  } else {
    score -= 15;
    reasons.push(`GPA below stated minimum`);
  }
  if (o.field !== "Any" && a.targetField.toLowerCase().includes(o.field.toLowerCase().split(" ")[0])) {
    score += 10;
    reasons.push(`Field aligned`);
  }
  return { score: Math.max(0, Math.min(99, score)), reasons };
}

export function generateSeedMatches(applicants: Applicant[], opportunities: Opportunity[]): Match[] {
  const out: Match[] = [];
  for (const a of applicants) {
    const scored = opportunities
      .map((o) => ({ o, ...scoreFor(a, o) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 6); // top 6 per applicant
    for (const s of scored) {
      out.push({
        applicantId: a.id,
        opportunityId: s.o.id,
        score: s.score,
        reasons: s.reasons,
        mentorDecision: null,
        mentorNote: "",
      });
    }
  }
  return out;
}

export const seedMatches = generateSeedMatches(seedApplicants, seedOpportunities);
