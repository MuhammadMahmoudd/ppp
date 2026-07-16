import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore, useT } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";
import type { Applicant, DegreeLevel, FundingType } from "@/lib/mockData";

export const Route = createFileRoute("/apply")({
  head: () => ({
    meta: [
      { title: "Apply — YNK Opportunities" },
      { name: "description", content: "Tell us about you and we'll match you to global opportunities." },
    ],
  }),
  component: ApplyPage,
});

const DEGREE_LEVELS: DegreeLevel[] = ["Diploma", "Bachelor", "Master", "PhD", "Short course"];
const FUNDING_TYPES: FundingType[] = [
  "Full scholarship",
  "Partial scholarship",
  "Grant",
  "Fellowship",
  "Exchange",
  "Internship",
];
const EXPERIENCE_OPTIONS = [
  "Research assistant",
  "Published research",
  "Internship",
  "Volunteer / NGO work",
  "Founded a startup",
  "Competition winner",
  "Teaching",
  "Leadership role",
];

const COUNTRIES = [
  "United Kingdom",
  "Germany",
  "Netherlands",
  "Sweden",
  "United States",
  "France",
  "Japan",
  "China",
  "Turkey",
  "Austria",
  "Saudi Arabia",
];

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  gender: "F" | "M" | "Other";
  dateOfBirth: string;
  degreeLevel: DegreeLevel;
  field: string;
  university: string;
  gpa: string;
  targetLevel: DegreeLevel;
  targetField: string;
  targetCountries: string[];
  englishLevel: "A2" | "B1" | "B2" | "C1" | "C2";
  ielts: string;
  experience: string[];
  fundingPreference: FundingType[];
  budgetMax: string;
  notes: string;
  documents: { name: string; kind: string }[];
}

const EMPTY: FormData = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  gender: "F",
  dateOfBirth: "",
  degreeLevel: "Bachelor",
  field: "",
  university: "",
  gpa: "",
  targetLevel: "Master",
  targetField: "",
  targetCountries: [],
  englishLevel: "B2",
  ielts: "",
  experience: [],
  fundingPreference: [],
  budgetMax: "",
  notes: "",
  documents: [],
};

function ApplyPage() {
  const t = useT();
  const { addApplicant, lang } = useStore();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(EMPTY);
  const [done, setDone] = useState(false);

  const steps = useMemo(
    () => [
      t("form.identity"),
      t("form.academic"),
      t("form.target"),
      t("form.language"),
      t("form.experience"),
      t("form.funding"),
      t("form.docs"),
    ],
    [lang],
  );

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setData((d) => ({ ...d, [k]: v }));

  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = () => {
    const a: Applicant = {
      id: `a_${Date.now()}`,
      fullName: data.fullName || "Untitled applicant",
      email: data.email,
      phone: data.phone,
      country: "Iraq",
      city: data.city,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      degreeLevel: data.degreeLevel,
      field: data.field,
      university: data.university,
      gpa: parseFloat(data.gpa) || 0,
      targetLevel: data.targetLevel,
      targetField: data.targetField,
      targetCountries: data.targetCountries,
      languages: [
        { name: "Kurdish", level: "C2" },
        { name: "English", level: data.englishLevel },
      ],
      ielts: data.ielts ? parseFloat(data.ielts) : undefined,
      experience: data.experience,
      fundingPreference: data.fundingPreference,
      budgetMax: data.budgetMax ? parseFloat(data.budgetMax) : undefined,
      notes: data.notes,
      documents: data.documents,
      createdAt: new Date().toISOString(),
      status: "New",
    };
    addApplicant(a);
    setDone(true);
    toast.success(t("form.done"));
  };

  if (done) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">{t("form.done")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("form.doneBody")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/admin">See it in Admin</Link>
            </Button>
            <Button variant="outline" onClick={() => { setData(EMPTY); setStep(0); setDone(false); }}>
              Submit another
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const pct = ((step + 1) / steps.length) * 100;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("form.step")} {step + 1} {t("form.of")} {steps.length} — <span className="text-foreground">{steps[step]}</span>
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="mt-2 h-1.5" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Full name">
              <Input value={data.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Shan Ibrahim" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+964 …" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City">
                <Input value={data.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Gender">
                <Select value={data.gender} onValueChange={(v) => set("gender", v as FormData["gender"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={data.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current level">
                <Select value={data.degreeLevel} onValueChange={(v) => set("degreeLevel", v as DegreeLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Field of study">
                <Input value={data.field} onChange={(e) => set("field", e.target.value)} placeholder="e.g. Computer Science" />
              </Field>
            </div>
            <Field label="University">
              <Input value={data.university} onChange={(e) => set("university", e.target.value)} />
            </Field>
            <Field label="GPA (out of 4)">
              <Input type="number" step="0.1" min="0" max="4" value={data.gpa} onChange={(e) => set("gpa", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target level">
                <Select value={data.targetLevel} onValueChange={(v) => set("targetLevel", v as DegreeLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEGREE_LEVELS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Target field">
                <Input value={data.targetField} onChange={(e) => set("targetField", e.target.value)} placeholder="e.g. Data Science" />
              </Field>
            </div>
            <Field label="Target countries (pick any)">
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => {
                  const on = data.targetCountries.includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() => set("targetCountries", toggleIn(data.targetCountries, c))}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <Field label="English level (CEFR)">
              <Select value={data.englishLevel} onValueChange={(v) => set("englishLevel", v as FormData["englishLevel"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A2", "B1", "B2", "C1", "C2"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="IELTS score (if any)">
              <Input type="number" step="0.5" min="0" max="9" value={data.ielts} onChange={(e) => set("ielts", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Check anything that applies:</p>
            {EXPERIENCE_OPTIONS.map((o) => {
              const on = data.experience.includes(o);
              return (
                <label key={o} className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-secondary/40">
                  <Checkbox checked={on} onCheckedChange={() => set("experience", toggleIn(data.experience, o))} />
                  <span className="text-sm">{o}</span>
                </label>
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4">
            <Field label="Funding preferences">
              <div className="flex flex-wrap gap-2">
                {FUNDING_TYPES.map((f) => {
                  const on = data.fundingPreference.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => set("fundingPreference", toggleIn(data.fundingPreference, f))}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Max out-of-pocket budget per year (USD, optional)">
              <Input type="number" value={data.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} />
            </Field>
            <Field label="Anything else we should know?">
              <Textarea rows={4} value={data.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">Upload your CV, transcripts, or writing samples. (Demo: files are not stored.)</p>
            <FakeUpload
              onFile={(name, kind) => set("documents", [...data.documents, { name, kind }])}
            />
            {data.documents.length > 0 && (
              <ul className="grid gap-2">
                {data.documents.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-primary" />
                      {d.name}
                    </span>
                    <Badge variant="secondary">{d.kind}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            {t("form.back")}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>{t("form.next")}</Button>
          ) : (
            <Button onClick={submit}>{t("form.submit")}</Button>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FakeUpload({ onFile }: { onFile: (name: string, kind: string) => void }) {
  const [kind, setKind] = useState("CV");
  return (
    <div className="grid gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="flex items-center gap-3">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["CV", "Transcript", "Passport", "Writing sample", "Portfolio", "Other"].map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary">
          <Upload className="size-4" /> Choose file
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                onFile(f.name, kind);
                toast.success(`Uploaded ${f.name}`);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Files never leave your browser — this is a prototype.</p>
    </div>
  );
}
