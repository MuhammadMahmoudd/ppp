import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/mentor/")({
  head: () => ({
    meta: [
      { title: "Mentor — My cases" },
      { name: "description", content: "Cases assigned to the current mentor." },
    ],
  }),
  component: MentorCases,
});

function MentorCases() {
  const { applicants, activeMentorId, matches } = useStore();
  const mine = applicants.filter((a) => a.assignedMentorId === activeMentorId);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-semibold">My cases</h1>
      <p className="text-sm text-muted-foreground">{mine.length} assigned to you.</p>

      <ul className="mt-6 grid gap-3">
        {mine.map((a) => {
          const ms = matches.filter((m) => m.applicantId === a.id);
          const approved = ms.filter((m) => m.mentorDecision === "approved").length;
          return (
            <li key={a.id}>
              <Link
                to="/mentor/cases/$id"
                params={{ id: a.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div>
                  <p className="font-medium">{a.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.targetLevel} · {a.targetField} · {a.targetCountries.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{a.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {approved}/{ms.length} approved
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          );
        })}
        {mine.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cases assigned. Switch mentor in the bar above, or assign from Admin.
          </li>
        )}
      </ul>
    </main>
  );
}
