import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/store";
import { ArrowRight, Users, LayoutGrid, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const t = useT();
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          Clickable prototype · not a real database
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          {t("brand")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground sm:text-xl">{t("tagline")}</p>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Walk the full journey end to end: apply as a student, triage the case as an admin,
          then approve a shortlist as a mentor. Use the role switcher in the header at any time.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <RoleCard
          to="/apply"
          icon={<Users className="size-5" />}
          title="Applicant"
          body="Multi-step intake form with Sorani/English and RTL support."
        />
        <RoleCard
          to="/admin"
          icon={<LayoutGrid className="size-5" />}
          title="Admin"
          body="Case board, applicant detail, and mentor assignment."
        />
        <RoleCard
          to="/mentor"
          icon={<GraduationCap className="size-5" />}
          title="Mentor"
          body="Matched shortlist with approve/reject and export view."
        />
      </div>
    </main>
  );
}

function RoleCard({
  to,
  icon,
  title,
  body,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
    >
      <div>
        <div className="grid size-9 place-items-center rounded-md bg-secondary text-foreground">{icon}</div>
        <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="mt-6 flex items-center text-sm font-medium text-foreground">
        Open
        <ArrowRight className="ms-1 size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
