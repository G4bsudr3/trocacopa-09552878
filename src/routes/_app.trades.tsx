import { createFileRoute, Link } from "@tanstack/react-router";
import { mockCollectors } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/trades")({
  head: () => ({ meta: [{ title: "Minhas Trocas — TrocaCopa" }] }),
  component: Trades,
});

function Trades() {
  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl tracking-wide">Minhas Trocas</h1>
      <div className="space-y-3 mt-5">
        {mockCollectors.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            to="/trade/$id"
            params={{ id: c.id }}
            className="glass rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground">
              {c.avatar}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.has.length} figurinhas para trocar</p>
            </div>
            <span className="text-primary font-display text-xl">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
