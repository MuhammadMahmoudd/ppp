import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { CASE_STATUSES, type CaseStatus } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/admin/cases/$id")({
  component: CaseDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">Case not found.</div>
  ),
});

function CaseDetail() {
  const { id } = Route.useParams();
  const {
    applicants,
    opportunities,
    matches,
    mentors,
    updateApplicantStatus,
    assignMentor,
  } = useStore();

  const a = applicants.find((x) => x.id === id);
  if (!a) throw notFound();

  const applicantMatches = matches
    .filter((m) => m.applicantId === a.id)
    .sort((x, y) => y.score - x.score);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to board
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{a.fullName}</h1>
                <p className="text-sm text-muted-foreground">
                  {a.degreeLevel} in {a.field} · {a.university}
                </p>
              </div>
              <Badge variant="secondary">GPA {a.gpa.toFixed(1)}</Badge>
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <InfoRow icon={<Mail className="size-4" />} label="Email" value={a.email} />
              <InfoRow icon={<Phone className="size-4" />} label="Phone" value={a.phone} />
              <InfoRow icon={<MapPin className="size-4" />} label="Location" value={`${a.city}, ${a.country}`} />
              <InfoRow icon={<GraduationCap className="size-4" />} label="Target" value={`${a.targetLevel} · ${a.targetField}`} />
            </dl>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Countries</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.targetCountries.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funding preference</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.fundingPreference.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                {a.experience.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>

            {a.notes && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Matched opportunities</h2>
            <p className="text-xs text-muted-foreground">Prototype: scores are demo-only, not the real engine.</p>
            <ul className="mt-4 divide-y divide-border">
              {applicantMatches.map((m) => {
                const op = opportunities.find((o) => o.id === m.opportunityId)!;
                return (
                  <li key={m.opportunityId} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{op.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {op.provider} · {op.country} · {op.fundingType}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{m.score}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">match</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</h3>
            <Select value={a.status} onValueChange={(v) => updateApplicantStatus(a.id, v as CaseStatus)}>
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned mentor</h3>
            <Select
              value={a.assignedMentorId ?? "none"}
              onValueChange={(v) => assignMentor(a.id, v === "none" ? undefined : v)}
            >
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {mentors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button asChild className="mt-6 w-full" variant="outline">
              <Link to="/mentor/cases/$id" params={{ id: a.id }}>Open mentor view</Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</h3>
            {a.documents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">None uploaded.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {a.documents.map((d, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{d.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{d.kind}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}
