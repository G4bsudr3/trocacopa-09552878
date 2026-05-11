import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Users, ShieldAlert, Gavel, AlertTriangle, Star, Repeat2, LogOut } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — TrocaCopa" },
      { name: "description", content: "Termos e condições de uso da plataforma TrocaCopa." },
    ],
  }),
  component: TermosPage,
});

const UPDATED = "10 de maio de 2026";

function TermosPage() {
  return (
    <main className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <Link to="/home" className="text-xs text-muted-foreground hover:text-primary">← Voltar</Link>

      <header className="mt-4 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
          <FileText size={12} /> Versão de {UPDATED}
        </div>
        <h1 className="font-display text-4xl text-primary text-glow">Termos de Uso</h1>
        <p className="text-muted-foreground mt-2">
          Ao criar uma conta ou usar o TrocaCopa, você concorda com estes termos. Leia com atenção.
        </p>
      </header>

      <Section icon={<FileText />} title="1. O que é o TrocaCopa">
        <p>
          O TrocaCopa é uma plataforma digital gratuita que permite a colecionadores de figurinhas da Copa do Mundo 2026
          encontrarem outros colecionadores próximos, negociarem e combinarem trocas presenciais. A plataforma não
          comercializa figurinhas, não intermedeia pagamentos e não garante o sucesso de nenhuma negociação.
        </p>
        <p className="mt-2">
          O TrocaCopa é operado por <strong>[Razão Social / Nome do operador]</strong>, CNPJ <strong>[CNPJ]</strong>,
          com sede em <strong>[endereço completo]</strong> — doravante denominado <em>TrocaCopa</em> ou <em>Plataforma</em>.
        </p>
      </Section>

      <Section icon={<Users />} title="2. Cadastro e elegibilidade">
        <p>Para usar o TrocaCopa você precisa:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Ter qualquer idade (crianças precisam de consentimento do responsável — veja seção 3);</li>
          <li>Fornecer dados verdadeiros no cadastro, incluindo data de nascimento real;</li>
          <li>Criar apenas <strong>uma conta</strong> por pessoa física;</li>
          <li>Usar uma senha pessoal e intransferível e mantê-la em sigilo;</li>
          <li>Ser o titular ou ter autorização expressa do titular do e-mail informado.</li>
        </ul>
        <p className="mt-2">
          Contas criadas com dados falsos, especialmente data de nascimento falsa para burlar a proteção a menores,
          serão encerradas e o fato poderá ser comunicado às autoridades competentes.
        </p>
      </Section>

      <Section icon={<ShieldAlert />} title="3. Menores de 18 anos — ECA Digital">
        <p>
          O TrocaCopa cumpre a Lei nº 15.211/2025 (ECA Digital). Para usuários menores de 18 anos:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li>
            <strong>Consentimento parental obrigatório:</strong> o responsável legal receberá um e-mail com link único
            para autorizar o uso. Sem autorização, trocas e o mapa ficam pausados.
          </li>
          <li>
            <strong>Modo Kids ativado automaticamente:</strong> perfil oculto de buscas públicas, sem localização GPS
            exata, bio ocultada, contato restrito a outros menores.
          </li>
          <li>
            <strong>Trocas apenas entre menores:</strong> usuários em Modo Kids não aparecem para adultos e não recebem
            mensagens de adultos desconhecidos.
          </li>
          <li>
            <strong>Revogação a qualquer tempo:</strong> o responsável pode revogar a autorização pelo link recebido
            por e-mail, encerrando imediatamente o acesso às funcionalidades sensíveis.
          </li>
          <li>
            <strong>Exclusão de dados:</strong> responsáveis podem solicitar a exclusão completa dos dados do menor
            por e-mail para <a className="text-primary" href="mailto:privacidade@trocacopa.com">privacidade@trocacopa.com</a>.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Base legal: art. 14 da LGPD; arts. 2º, 3º, 5º, 17, 22 e 27 da Lei nº 15.211/2025.
        </p>
      </Section>

      <Section icon={<Repeat2 />} title="4. Regras das trocas">
        <p>As trocas no TrocaCopa são combinadas entre os próprios usuários. A plataforma:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Não participa do encontro físico nem valida as figurinhas trocadas;</li>
          <li>Não se responsabiliza por trocas não realizadas, desentendimentos ou danos ocorridos nos encontros;</li>
          <li>Recomenda fortemente que encontros sejam feitos em <strong>locais públicos e movimentados</strong>,
              especialmente quando envolver menores de idade, sempre na presença de um responsável;</li>
          <li>Registra o status das trocas apenas para organização interna do usuário.</li>
        </ul>
        <p className="mt-2">
          O TrocaCopa não é um marketplace. Nenhuma figurinha pode ser vendida ou anunciada com valor monetário
          dentro da plataforma.
        </p>
      </Section>

      <Section icon={<Star />} title="5. Avaliações e conteúdo gerado pelo usuário">
        <p>
          Ao publicar bio, enviar mensagens em trocas ou submeter avaliações, você declara que o conteúdo é verdadeiro,
          não viola direitos de terceiros e está em conformidade com as leis brasileiras.
        </p>
        <p className="mt-2">É proibido publicar:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Conteúdo sexual, violento, discriminatório ou ilegal;</li>
          <li>Dados pessoais de terceiros sem consentimento;</li>
          <li>Informações falsas, spam ou conteúdo enganoso;</li>
          <li>Links para sites externos, especialmente em contextos envolvendo menores.</li>
        </ul>
        <p className="mt-2">
          O TrocaCopa pode remover qualquer conteúdo que viole estas regras sem aviso prévio e encerrar a conta responsável.
        </p>
      </Section>

      <Section icon={<AlertTriangle />} title="6. Condutas proibidas">
        <p>É expressamente vedado:</p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li>Criar múltiplas contas para burlar suspensões ou restrições;</li>
          <li>Usar a plataforma para fins comerciais (venda de figurinhas, publicidade, etc.);</li>
          <li>Tentar contato com menores de forma inapropriada — configura crime nos termos do ECA;</li>
          <li>Realizar engenharia reversa, scraping ou extração automatizada de dados;</li>
          <li>Comprometer a segurança ou disponibilidade da plataforma;</li>
          <li>Fornecer dados de terceiros sem autorização (e-mail, nome, etc.);</li>
          <li>Burlar as proteções do Modo Kids ou qualquer mecanismo de segurança.</li>
        </ul>
      </Section>

      <Section icon={<LogOut />} title="7. Encerramento de conta">
        <p>
          Você pode excluir sua conta a qualquer momento em <strong>Configurações → Excluir conta</strong>. A exclusão
          remove permanentemente seu perfil, álbum, histórico de trocas e dados associados, conforme nossa
          Política de Privacidade.
        </p>
        <p className="mt-2">
          O TrocaCopa pode suspender ou encerrar contas que violem estes Termos, sem prejuízo de ação
          legal cabível. Em casos graves envolvendo menores, o fato será comunicado ao Ministério Público ou
          às autoridades de proteção à infância.
        </p>
      </Section>

      <Section icon={<Gavel />} title="8. Propriedade intelectual">
        <p>
          A marca TrocaCopa, o design, o código-fonte e os conteúdos originais da plataforma são protegidos pela
          Lei nº 9.279/1996 (Propriedade Industrial) e Lei nº 9.610/1998 (Direitos Autorais). O álbum da Copa do Mundo
          2026 e os nomes de jogadores são propriedade da FIFA e de seus licenciados — o TrocaCopa não tem qualquer
          vínculo ou patrocínio da FIFA.
        </p>
        <p className="mt-2">
          Ao fazer upload de uma foto de perfil ou contribuir com imagens, você concede ao TrocaCopa licença não exclusiva
          e gratuita para exibição dentro da plataforma, podendo revogar conforme a Política de Privacidade.
        </p>
      </Section>

      <Section icon={<AlertTriangle />} title="9. Limitação de responsabilidade">
        <p>
          O TrocaCopa é prestado <em>no estado em que se encontra</em> (<em>as is</em>), sem garantia de disponibilidade
          contínua. Não nos responsabilizamos por:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Danos decorrentes de encontros combinados fora da plataforma;</li>
          <li>Perda ou furto de figurinhas;</li>
          <li>Conteúdo publicado por outros usuários;</li>
          <li>Interrupções temporárias do serviço;</li>
          <li>Dados inseridos incorretamente pelo próprio usuário.</li>
        </ul>
        <p className="mt-2">
          Nada nestes Termos limita direitos que você possui perante o Código de Defesa do Consumidor
          (Lei nº 8.078/1990) ou outra lei de ordem pública.
        </p>
      </Section>

      <Section icon={<Gavel />} title="10. Alterações e foro">
        <p>
          Podemos atualizar estes Termos a qualquer tempo. Alterações relevantes serão comunicadas por
          notificação na plataforma com antecedência mínima de 15 dias. O uso continuado após esse prazo
          implica aceitação.
        </p>
        <p className="mt-2">
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca
          de <strong>[Cidade/UF]</strong>, com renúncia a qualquer outro, por mais privilegiado que seja,
          para resolução de disputas, sem prejuízo dos direitos do consumidor.
        </p>
      </Section>

      <div className="mt-8 flex flex-col sm:flex-row gap-2 text-center text-xs text-muted-foreground">
        <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
        <span className="hidden sm:inline">·</span>
        <Link to="/seguranca" className="text-primary hover:underline">Segurança e Crianças</Link>
        <span className="hidden sm:inline">·</span>
        <span>Dúvidas: <a className="text-primary" href="mailto:suporte@trocacopa.com">suporte@trocacopa.com</a></span>
      </div>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="glass-strong rounded-3xl p-5 mb-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1">
          <h2 className="font-display text-lg text-primary mb-2">{title}</h2>
          <div className="text-sm text-foreground/90 leading-relaxed">{children}</div>
        </div>
      </div>
    </section>
  );
}
