import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Share2, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

function genCode(len = 8) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function InviteFriendSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !user || code) return;
    setBusy(true);
    (async () => {
      const { data: existing } = await supabase
        .from("invites")
        .select("code")
        .eq("inviter_id", user.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.code) {
        setCode(existing.code);
      } else {
        const newCode = genCode();
        const { error } = await supabase.from("invites").insert({ inviter_id: user.id, code: newCode });
        if (error) toast.error("Não foi possível gerar o convite");
        else setCode(newCode);
      }
      setBusy(false);
    })();
  }, [open, user, code]);

  const url = code ? `${window.location.origin}/invite/${code}` : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const share = async () => {
    if (!url) return;
    const text = "Vem trocar figurinhas comigo no TrocaAI! ⚽";
    if (navigator.share) {
      try {
        await navigator.share({ title: "TrocaAI", text, url });
      } catch {
        // user cancelled
      }
    } else {
      copy();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">Convidar amigo</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col items-center gap-4 pb-6">
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Mostre o QR ou compartilhe o link. Quem entrar já vira seu amigo no app e vocês podem trocar na hora.
          </p>
          <div className="bg-white rounded-2xl p-4 shadow-card">
            {busy || !url ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#000000" level="M" />
            )}
          </div>
          {url && (
            <div className="w-full bg-surface rounded-xl px-3 py-2 text-xs text-center break-all">{url}</div>
          )}
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              onClick={copy}
              disabled={!url}
              className="glass rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Copy size={14} /> Copiar link
            </button>
            <button
              onClick={share}
              disabled={!url}
              className="gradient-primary text-primary-foreground rounded-full py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Share2 size={14} /> Compartilhar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
