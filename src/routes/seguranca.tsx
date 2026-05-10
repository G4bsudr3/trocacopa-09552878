import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mail, Flag, Baby, Lock } from "lucide-react";

export const Route = createFileRoute("/seguranca")({
  head: () => ({
    meta: [
      { title: "Segurança e Crianças — TrocaCopa" },
      { name: "description", content: "Como o TrocaCopa protege crianças e adolescentes conforme a Lei nº 15.211/2025 (ECA Digital)." },
    ],
  }),
  component: SegurancaPage,
});

function SegurancaPage() {
  return (
    <main className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <Link to="/home" className="text-xs text-muted-foreground hover:text-primary">← Voltar</Link>

      <header className="mt-4 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 text-gold text-[10px] font-bold uppercase tracking-wider mb-3">
          <Shield size={12} /> ECA Digital · Lei 15.211/2025
        </div>
        <h1 className="font-display text-4xl text-primary text-glow">Segurança & Crianças</h1>
        <p className="text-muted-foreground mt-2">Como protegemos quem ainda não tem 18 anos no TrocaCopa.</p>
      </header>

      <Section icon={<Baby />} title="Verificação de idade no cadastro">
        Pedimos a data de nascimento e classificamos automaticamente em criança (&lt;13), adolescente (13-17) ou adulto.
        Recursos como trocas e mapa só ficam disponíveis depois dessa verificação.
      </Section>

      <Section icon={<Mail />} title="Consentimento do responsável">
        Para menores de 18 anos, enviamos um e-mail ao responsável com um link único para autorizar o uso.
        Sem essa autorização, a conta fica em modo limitado. O responsável pode revogar a qualquer momento usando o mesmo link.
      </Section>

      <Section icon={<Lock />} title="Modo Kids (privacidade por padrão)">
        Quando o usuário é menor, ativamos automaticamente:
        <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
          <li>Perfil oculto de buscas públicas</li>
          <li>Localização exata (GPS) bloqueada — só cidade aparece</li>
          <li>Bio escondida</li>
          <li>Trocas apenas com outros menores — sem contato com adultos desconhecidos</li>
          <li>Avisos para combinar trocas em locais públicos com um responsável</li>
        </ul>
      </Section>

      <Section icon={<Flag />} title="Canal de denúncia">
        Toda tela de troca, mensagem e perfil tem um botão "Denunciar". Reportes vão direto para nossa equipe e podem
        levar a suspensão de contas. Em emergências, ligue <strong>100</strong> (Disque Direitos Humanos).
      </Section>

      <Section icon={<Shield />} title="Direitos do responsável">
        O responsável pode, a qualquer momento:
        <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
          <li>Revogar a autorização (link recebido por e-mail)</li>
          <li>Solicitar exclusão dos dados do menor por <a className="text-primary" href="mailto:suporte@trocacopa.com">suporte@trocacopa.com</a></li>
          <li>Pedir histórico de atividade da conta</li>
        </ul>
      </Section>

      <p className="text-xs text-muted-foreground text-center mt-10">
        Dúvidas ou denúncias: <a className="text-primary" href="mailto:suporte@trocacopa.com">suporte@trocacopa.com</a>
      </p>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="glass-strong rounded-3xl p-5 mb-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">{icon}</span>
        <div>
          <h2 className="font-display text-lg text-primary mb-1">{title}</h2>
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </section>
  );
}
