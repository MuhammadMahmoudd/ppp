import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/admin/opportunities")({
  head: () => ({
    meta: [
      { title: "Admin — Opportunities" },
      { name: "description", content: "Catalogue of scholarship, fellowship, and grant opportunities." },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const { opportunities } = useStore();
  const [q, setQ] = useState("");
  const filtered = opportunities.filter(
    (o) =>
      !q ||
      o.name.toLowerCase().includes(q.toLowerCase()) ||
      o.country.toLowerCase().includes(q.toLowerCase()) ||
      o.field.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">{opportunities.length} in the catalogue.</p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, country, field…"
          className="max-w-xs"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Name</th>
              <th className="px-4 py-3 text-start">Country</th>
              <th className="px-4 py-3 text-start">Level</th>
              <th className="px-4 py-3 text-start">Funding</th>
              <th className="px-4 py-3 text-start">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.provider} · {o.field}</div>
                </td>
                <td className="px-4 py-3">{o.country}</td>
                <td className="px-4 py-3"><Badge variant="outline">{o.level}</Badge></td>
                <td className="px-4 py-3">{o.fundingType}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(o.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
