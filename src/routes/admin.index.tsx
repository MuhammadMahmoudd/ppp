import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CASE_STATUSES, type Applicant, type CaseStatus } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin — Case board" },
      { name: "description", content: "Kanban board of applicant cases across statuses." },
    ],
  }),
  component: AdminBoard,
});

function AdminBoard() {
  const { applicants, updateApplicantStatus, mentors } = useStore();
  const [dragging, setDragging] = useState<string | null>(null);

  const byStatus = (s: CaseStatus) => applicants.filter((a) => a.status === s);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Case board</h1>
          <p className="text-sm text-muted-foreground">
            {applicants.length} applicants · drag between columns to update status.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-7">
        {CASE_STATUSES.map((status) => (
          <div
            key={status}
            className="flex min-h-[300px] flex-col rounded-lg border border-border bg-secondary/30 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || dragging;
              if (id) updateApplicantStatus(id, status);
              setDragging(null);
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{status}</h2>
              <span className="text-xs text-muted-foreground">{byStatus(status).length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {byStatus(status).map((a) => (
                <CaseCard
                  key={a.id}
                  applicant={a}
                  mentorName={mentors.find((m) => m.id === a.assignedMentorId)?.name}
                  onDragStart={() => setDragging(a.id)}
                />
              ))}
              {byStatus(status).length === 0 && (
                <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function CaseCard({
  applicant,
  mentorName,
  onDragStart,
}: {
  applicant: Applicant;
  mentorName?: string;
  onDragStart: () => void;
}) {
  return (
    <Link
      to="/admin/cases/$id"
      params={{ id: applicant.id }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", applicant.id);
        onDragStart();
      }}
      className="block cursor-grab rounded-md border border-border bg-card p-3 text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{applicant.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {applicant.targetLevel} · {applicant.targetField}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          GPA {applicant.gpa.toFixed(1)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {applicant.targetCountries.slice(0, 3).map((c) => (
          <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {c}
          </span>
        ))}
      </div>
      {mentorName && (
        <p className="mt-2 text-[11px] text-muted-foreground">Mentor: <span className="text-foreground">{mentorName}</span></p>
      )}
    </Link>
  );
}
