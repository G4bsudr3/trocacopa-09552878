import { createFileRoute } from "@tanstack/react-router";
import { mockNotifications } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notificações — TrocaCopa" }] }),
  component: Notifs,
});

function Notifs() {
  const [items, setItems] = useState(mockNotifications);
  return (
    <div className="px-5 pt-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Notificações</h1>
        <button onClick={() => setItems(items.map(i => ({ ...i, unread: false })))} className="text-xs text-primary font-semibold">
          Marcar como lidas
        </button>
      </div>

      <div className="space-y-2 mt-5">
        {items.map((n) => (
          <div key={n.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${n.unread ? "border border-primary/30" : ""}`}>
            <span className="text-2xl">{n.icon}</span>
            <div className="flex-1">
              <p className="text-sm">{n.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
            </div>
            {n.unread && <span className="w-2 h-2 rounded-full bg-primary" />}
          </div>
        ))}
      </div>
    </div>
  );
}
