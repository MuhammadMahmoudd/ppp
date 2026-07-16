import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/mentor")({
  component: MentorLayout,
});

function MentorLayout() {
  const { mentors, activeMentorId, setActiveMentorId } = useStore();
  return (
    <div>
      <div className="border-b border-border/60 bg-secondary/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="text-sm">
            <span className="text-muted-foreground">Signed in as</span>{" "}
            <span className="font-medium">{mentors.find((m) => m.id === activeMentorId)?.name}</span>
          </div>
          <Select value={activeMentorId} onValueChange={setActiveMentorId}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mentors.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} — {m.focus}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
