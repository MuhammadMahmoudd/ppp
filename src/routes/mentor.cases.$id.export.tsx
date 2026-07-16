import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mentor/cases/$id/export")({
  component: ExportView,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">Case not found.</div>
  ),
});

function ExportView() {
  const { id } = Route.useParams();
  const { applicants, opportunities, matches, mentors, activeMentorId } = useStore();
  const a = applicants.find((x) => x.id === id);
  if (!a) throw notFound();

  const mentor = mentors.find((m) => m.id === activeMentorId);
  const approved = matches
    .filter((m) => m.applicantId === a.id && m.mentorDecision === "approved")
    .sort((x, y) => y.score - x.score);

  const text = buildPlainText(a.fullName, mentor?.name ?? "Mentor", approved, opportunities);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/mentor/cases/$id"
          params={{ id: a.id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
          }}
        >
          <Copy className="size-4" /> Copy
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 font-mono text-sm leading-relaxed">
        <p className="font-sans text-lg font-semibold">YNK Opportunities · Shortlist for {a.fullName}</p>
        <p className="mt-1 font-sans text-xs text-muted-foreground">
          Prepared by {mentor?.name} · {new Date().toLocaleDateString()}
        </p>
        <hr className="my-4 border-border" />
        {approved.length === 0 ? (
          <p className="text-muted-foreground">No opportunities approved yet.</p>
        ) : (
          <ol className="space-y-5">
            {approved.map((m, i) => {
              const op = opportunities.find((o) => o.id === m.opportunityId)!;
              return (
                <li key={m.opportunityId}>
                  <p className="font-sans font-semibold">
                    {i + 1}. {op.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {op.provider} · {op.country} · {op.fundingType}
                  </p>
                  <p className="mt-1">Deadline: {new Date(op.deadline).toLocaleDateString()}</p>
                  <p>Fit: {m.score}/100</p>
                  <p className="break-all">Link: {op.url}</p>
                  {m.mentorNote && <p className="mt-1 italic">Note: {m.mentorNote}</p>}
                </li>
              );
            })}
          </ol>
        )}
        <hr className="my-4 border-border" />
        <p className="text-xs text-muted-foreground">
          Reply to this message with any questions. Good luck!
        </p>
      </div>
    </main>
  );
}

function buildPlainText(
  applicantName: string,
  mentorName: string,
  approved: ReturnType<typeof Array.prototype.filter>,
  opportunities: ReturnType<typeof useStore>["opportunities"],
): string {
  const lines: string[] = [];
  lines.push(`YNK Opportunities — Shortlist for ${applicantName}`);
  lines.push(`Prepared by ${mentorName} · ${new Date().toLocaleDateString()}`);
  lines.push("");
  (approved as any[]).forEach((m, i) => {
    const op = opportunities.find((o) => o.id === m.opportunityId);
    if (!op) return;
    lines.push(`${i + 1}. ${op.name} (${op.provider})`);
    lines.push(`   ${op.country} · ${op.fundingType}`);
    lines.push(`   Deadline: ${new Date(op.deadline).toLocaleDateString()}`);
    lines.push(`   Fit: ${m.score}/100`);
    lines.push(`   ${op.url}`);
    if (m.mentorNote) lines.push(`   Note: ${m.mentorNote}`);
    lines.push("");
  });
  return lines.join("\n");
}
