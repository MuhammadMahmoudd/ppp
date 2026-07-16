import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useStore, useT, type Role } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";

const ROLE_HOME: Record<Role, string> = {
  applicant: "/apply",
  admin: "/admin",
  mentor: "/mentor",
};

export function AppHeader() {
  const { role, setRole, lang, setLang } = useStore();
  const t = useT();
  const router = useRouterState();
  const navigate = useNavigate();
  const path = router.location.pathname;


  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">{t("brand")}</span>
          <span className="ml-2 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
            Prototype
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/apply" active={path.startsWith("/apply")}>{t("nav.apply")}</NavLink>
          <NavLink to="/admin" active={path.startsWith("/admin")}>{t("nav.admin")}</NavLink>
          <NavLink to="/mentor" active={path.startsWith("/mentor")}>{t("nav.mentor")}</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs text-muted-foreground">{t("role.viewing")}</span>
            <Select
              value={role}
              onValueChange={(v) => {
                const r = v as Role;
                setRole(r);
                navigate({ to: ROLE_HOME[r] });
              }}

            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="applicant">{t("role.applicant")}</SelectItem>
                <SelectItem value="admin">{t("role.admin")}</SelectItem>
                <SelectItem value="mentor">{t("role.mentor")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setLang(lang === "en" ? "ku" : "en")}
          >
            {t("lang.toggle")}
          </Button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"
      }`}
    >
      {children}
    </Link>
  );
}
