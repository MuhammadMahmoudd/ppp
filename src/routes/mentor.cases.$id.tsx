import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, X, FileText } from "lucide-react";

export const Route = createFileRoute("/mentor/cases/$id")({
  component: MentorCaseDetail,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">Case not found.</div>
  ),
});

function MentorCaseDetail() {
  const { id } = Route.useParams();
  const { applicants, opportunities, matches, setMatchDecision, setMatchNote } = useStore();
  const a = applicants.find((x) => x.id === id);
  if (!a) throw notFound();

  const applicantMatches = matches
    .filter((m) => m.applicantId === a.id)
    .sort((x, y) => y.score - x.score);

  const approved = applicantMatches.filter((m) => m.mentorDecision === "approved").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link to="/mentor" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to my cases
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-semibold">{a.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {a.targetLevel} · {a.targetField} · Wants: {a.targetCountries.join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="secondary">GPA {a.gpa.toFixed(1)}</Badge>
            {a.ielts && <Badge variant="secondary">IELTS {a.ielts}</Badge>}
            {a.fundingPreference.map((f) => <Badge key={f} variant="outline">{f}</Badge>)}
          </div>
        </div>
        <Button asChild>
          <Link to="/mentor/cases/$id/export" params={{ id: a.id }}>
            <FileText className="size-4" /> Export view
          </Link>
        </Button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold">Shortlist</h2>
        <span className="text-xs text-muted-foreground">{approved}/{applicantMatches.length} approved</span>
      </div>

      <ul className="mt-3 grid gap-3">
        {applicantMatches.map((m) => {
          const op = opportunities.find((o) => o.id === m.opportunityId)!;
          const decision = m.mentorDecision;
          return (
            <li
              key={m.opportunityId}
              className={`rounded-xl border p-4 transition-colors ${
                decision === "approved"
                  ? "border-primary/50 bg-primary/5"
                  : decision === "rejected"
                  ? "border-border bg-secondary/20 opacity-60"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{op.name}</h3>
                    <Badge variant="outline" className="shrink-0">{m.score} match</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {op.provider} · {op.country} · {op.fundingType} · Deadline{" "}
                    {new Date(op.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{op.summary}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {m.reasons.map((r, i) => (
                      <li key={i} className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={decision === "approved" ? "default" : "outline"}
                    onClick={() => setMatchDecision(a.id, op.id, decision === "approved" ? null : "approved")}
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={decision === "rejected" ? "secondary" : "outline"}
                    onClick={() => setMatchDecision(a.id, op.id, decision === "rejected" ? null : "rejected")}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </div>
              <Textarea
                value={m.mentorNote ?? ""}
                onChange={(e) => setMatchNote(a.id, op.id, e.target.value)}
                placeholder="Note for the applicant (why this fits, next steps, docs to prepare…)"
                rows={2}
                className="mt-3"
              />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
