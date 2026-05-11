import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Database, Users, Globe, Clock, Lock, UserCheck, Mail, AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — TrocaCopa" },
      { name: "description", content: "Política de privacidade e proteção de dados da plataforma TrocaCopa." },
    ],
  }),
  component: PrivacidadePage,
});

const UPDATED = "10 de maio de 2026";

function PrivacidadePage() {
  return (
    <main className="min-h-screen px-5 py-8 max-w-2xl mx-auto">
      <Link to="/home" className="text-xs text-muted-foreground hover:text-primary">← Voltar</Link>

      <header className="mt-4 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
          <Shield size={12} /> Versão de {UPDATED}
        </div>
        <h1 className="font-display text-4xl text-primary text-glow">Política de Privacidade</h1>
        <p className="text-muted-foreground mt-2">
          Explicamos aqui quais dados coletamos, por que coletamos e como você pode exercer seus direitos. Leia com atenção.
        </p>
      </header>

      <Section icon={<FileText />} title="1. Quem somos (controlador dos dados)">
        <p>
          O controlador dos dados pessoais tratados por esta Política é <strong>[Razão Social / Nome do operador]</strong>,
          CNPJ <strong>[CNPJ]</strong>, com sede em <strong>[endereço completo]</strong> — doravante denominado
          <em> TrocaCopa</em>.
        </p>
        <p className="mt-2">
          Dúvidas, solicitações e exercício de direitos: <a className="text-primary" href="mailto:privacidade@trocacopa.com">privacidade@trocacopa.com</a>.
          Encarregado de Proteção de Dados (DPO): <strong>[nome do DPO]</strong>,
          <a className="text-primary ml-1" href="mailto:dpo@trocacopa.com">dpo@trocacopa.com</a>.
        </p>
      </Section>

      <Section icon={<Database />} title="2. Dados que coletamos e por quê">
        <p className="mb-2">Tratamos apenas os dados estritamente necessários para o funcionamento da plataforma.</p>

        <TableCard rows={[
          { dado: "E-mail", finalidade: "Autenticação e comunicações transacionais", base: "Execução de contrato (Art. 7º, V, LGPD)" },
          { dado: "Nome completo", finalidade: "Exibição de perfil público", base: "Execução de contrato (Art. 7º, V)" },
          { dado: "Data de nascimento", finalidade: "Verificação de idade e ativação do Modo Kids para menores", base: "Obrigação legal — Lei nº 15.211/2025 (Art. 7º, II, LGPD)" },
          { dado: "Cidade / localização textual", finalidade: "Exibição na lista de colecionadores próximos (sem GPS)", base: "Execução de contrato (Art. 7º, V)" },
          { dado: "Coordenadas GPS (lat/lng)", finalidade: "Cálculo de distância precisa entre colecionadores", base: "Consentimento — solicitado explicitamente (Art. 7º, I)" },
          { dado: "Foto de perfil", finalidade: "Identificação visual no perfil e nas trocas", base: "Consentimento (Art. 7º, I)" },
          { dado: "Bio do perfil", finalidade: "Apresentação ao outros colecionadores", base: "Consentimento (Art. 7º, I)" },
          { dado: "Figurinhas marcadas / repetidas", finalidade: "Álbum digital e matching de trocas", base: "Execução de contrato (Art. 7º, V)" },
          { dado: "Histórico de trocas e mensagens", finalidade: "Gestão das negociações entre usuários", base: "Execução de contrato (Art. 7º, V)" },
          { dado: "Avaliações recebidas", finalidade: "Reputação pública do colecionador", base: "Interesse legítimo (Art. 7º, IX)" },
          { dado: "Preferências de notificação", finalidade: "Envio de notificações push/e-mail conforme escolha do usuário", base: "Consentimento (Art. 7º, I)" },
          { dado: "Código de convite gerado/usado", finalidade: "Programa de indicações", base: "Execução de contrato (Art. 7º, V)" },
          { dado: "Nome e e-mail do responsável (menor)", finalidade: "Envio do link de autorização parental; cumprimento do ECA Digital", base: "Obrigação legal — Lei nº 15.211/2025 (Art. 7º, II)" },
          { dado: "Logs de acesso (IP, user-agent, timestamp)", finalidade: "Segurança, prevenção de fraudes e cumprimento do Marco Civil", base: "Obrigação legal — Art. 15 da Lei nº 12.965/2014 (Art. 7º, II, LGPD)" },
          { dado: "Tokens de sessão (localStorage)", finalidade: "Manutenção da sessão autenticada no navegador do dispositivo", base: "Execução de contrato (Art. 7º, V)" },
        ]} />

        <p className="mt-3 text-xs text-muted-foreground">
          Não coletamos dados de cartão de crédito, CPF ou documentos de identidade.
        </p>
      </Section>

      <Section icon={<Users />} title="3. Dados de crianças e adolescentes (ECA Digital)">
        <p>
          O TrocaCopa cumpre a <strong>Lei nº 15.211/2025 (ECA Digital)</strong> e o <strong>Art. 14 da LGPD</strong>.
          Para usuários com menos de 18 anos:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li>
            <strong>Consentimento parental obrigatório:</strong> o responsável legal recebe e-mail com link único para
            autorizar o cadastro. Sem autorização expressa, as funcionalidades sensíveis (mapa, trocas, mensagens) ficam
            pausadas.
          </li>
          <li>
            <strong>Modo Kids automático:</strong> perfil oculto de buscas gerais, sem localização GPS exata, bio
            ocultada e contato restrito a outros menores.
          </li>
          <li>
            <strong>Finalidade específica:</strong> dados de menores são usados exclusivamente para as trocas de
            figurinhas dentro da plataforma — sem publicidade comportamental, sem compartilhamento com terceiros para
            fins de marketing.
          </li>
          <li>
            <strong>Acesso do responsável:</strong> o responsável pode solicitar relatório, correção ou exclusão
            completa dos dados do menor a qualquer tempo, por e-mail para{" "}
            <a className="text-primary" href="mailto:privacidade@trocacopa.com">privacidade@trocacopa.com</a>.
          </li>
          <li>
            <strong>Revogação:</strong> o responsável pode revogar o consentimento pelo link recebido no e-mail de
            autorização, encerrando imediatamente o acesso do menor às funcionalidades sensíveis.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Base legal: Art. 14 da LGPD; arts. 2º, 3º, 5º, 17, 22 e 27 da Lei nº 15.211/2025.
        </p>
      </Section>

      <Section icon={<Globe />} title="4. Compartilhamento e operadores (subprocessadores)">
        <p>Não vendemos nem alugamos seus dados. Compartilhamos apenas com os operadores técnicos listados abaixo:</p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li>
            <strong>Supabase, Inc. (EUA)</strong> — banco de dados PostgreSQL, autenticação, armazenamento de arquivos
            e funções serverless. Dados hospedados em infraestrutura da Amazon Web Services (região us-east-1).
            Transferência internacional amparada por <em>Standard Contractual Clauses</em> (SCCs) e Data Processing
            Agreement celebrado com a Supabase.
          </li>
          <li>
            <strong>Google LLC (EUA)</strong> — login opcional via Google OAuth 2.0. Ao usar "Entrar com Google", o
            Google autentica sua conta e retorna nome e e-mail. Consulte a{" "}
            <a className="text-primary" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Política de Privacidade do Google
            </a>.
          </li>
          <li>
            <strong>OpenStreetMap Foundation (Reino Unido)</strong> — tiles do mapa exibidos na tela de colecionadores
            próximos. Nenhum dado pessoal é enviado ao OSM.
          </li>
          <li>
            <strong>Tesseract.js</strong> — OCR de figurinhas processado <em>localmente no seu dispositivo</em>. Nenhuma
            imagem é enviada a servidores externos durante o escaneamento.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Base legal para transferência internacional: Art. 33, II (garantias adequadas / SCCs) e Art. 33, V (execução
          de contrato) da LGPD.
        </p>
      </Section>

      <Section icon={<Clock />} title="5. Retenção dos dados">
        <ul className="list-disc list-inside mt-1 space-y-1.5 text-sm">
          <li><strong>Conta ativa:</strong> dados mantidos enquanto a conta existir.</li>
          <li>
            <strong>Após exclusão voluntária:</strong> dados removidos em até <strong>30 dias</strong>, exceto os
            mínimos exigidos por lei (logs de acesso retidos por 6 meses conforme Art. 15 do Marco Civil; dados
            fiscais/contábeis conforme legislação tributária, se aplicável).
          </li>
          <li>
            <strong>Dados de menores:</strong> excluídos integralmente após encerramento da conta ou mediante
            solicitação do responsável, respeitado o prazo de 30 dias.
          </li>
          <li>
            <strong>Backups:</strong> removidos dos ciclos de backup em até 90 dias após a exclusão da conta.
          </li>
        </ul>
      </Section>

      <Section icon={<Lock />} title="6. Segurança">
        <p>Adotamos medidas técnicas e organizacionais adequadas ao risco, incluindo:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Comunicação cifrada via TLS/HTTPS em todos os endpoints;</li>
          <li>Senhas armazenadas com hash bcrypt (via Supabase Auth — nenhuma senha em texto simples);</li>
          <li>Tokens de sessão gerados criptograficamente e armazenados no localStorage do dispositivo do usuário;</li>
          <li>Row-Level Security (RLS) no banco de dados — cada usuário acessa apenas seus próprios dados;</li>
          <li>Segregação de funções: Edge Functions com permissões mínimas via service role controlado;</li>
          <li>Modo Kids com restrições de acesso e ocultação de dados sensíveis de menores.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Em caso de incidente de segurança que envolva risco relevante aos titulares, notificaremos a ANPD e os
          usuários afetados no prazo previsto pelo Art. 48 da LGPD.
        </p>
      </Section>

      <Section icon={<UserCheck />} title="7. Seus direitos (Art. 18 da LGPD)">
        <p>Você tem o direito de, a qualquer momento:</p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter cópia deles;</li>
          <li><strong>Correção:</strong> corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou tratados em
              desconformidade com a LGPD;</li>
          <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado para transferência a outro
              serviço;</li>
          <li><strong>Eliminação completa:</strong> excluir todos os seus dados — acesse em <strong>Configurações → Excluir conta</strong>;</li>
          <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades compartilhamos seus dados;</li>
          <li><strong>Revogação do consentimento:</strong> cancelar consentimentos dados (ex.: GPS, foto) a qualquer
              momento — o tratamento anterior permanece lícito;</li>
          <li><strong>Oposição:</strong> opor-se ao tratamento realizado com base em legítimo interesse;</li>
          <li><strong>Revisão de decisões automatizadas:</strong> solicitar revisão humana de decisões tomadas
              exclusivamente com base em tratamento automatizado.</li>
        </ul>
        <p className="mt-3 text-sm">
          Para exercer qualquer direito, envie e-mail para{" "}
          <a className="text-primary" href="mailto:privacidade@trocacopa.com">privacidade@trocacopa.com</a> com o assunto
          "Direitos LGPD". Responderemos em até <strong>15 dias</strong>.
        </p>
      </Section>

      <Section icon={<Mail />} title="8. Cookies e armazenamento local">
        <p>O TrocaCopa é uma <em>Progressive Web App</em> (PWA) e utiliza:</p>
        <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
          <li>
            <strong>localStorage:</strong> armazena o token de sessão e preferências de tema no seu dispositivo.
            Não há rastreamento entre sessões ou fingerprinting.
          </li>
          <li>
            <strong>Service Worker (cache):</strong> armazena assets estáticos para funcionamento offline. Nenhum dado
            pessoal é incluído no cache do Service Worker.
          </li>
          <li>
            <strong>Sem cookies de terceiros para publicidade:</strong> não utilizamos pixels de rastreamento, cookies
            de anúncios ou ferramentas de análise comportamental de terceiros.
          </li>
        </ul>
      </Section>

      <Section icon={<AlertTriangle />} title="9. Alterações desta Política">
        <p>
          Podemos atualizar esta Política a qualquer tempo. Alterações relevantes serão comunicadas por notificação
          na plataforma com antecedência mínima de <strong>15 dias</strong>. O uso continuado após esse prazo
          implica aceitação da versão atualizada.
        </p>
        <p className="mt-2">
          Esta Política é regida pela legislação brasileira, em especial pela Lei nº 13.709/2018 (LGPD),
          Lei nº 15.211/2025 (ECA Digital) e Lei nº 12.965/2014 (Marco Civil da Internet).
          Fica eleito o foro da comarca de <strong>[Cidade/UF]</strong> para solução de controvérsias.
        </p>
      </Section>

      <div className="mt-8 flex flex-col sm:flex-row gap-2 text-center text-xs text-muted-foreground">
        <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>
        <span className="hidden sm:inline">·</span>
        <Link to="/seguranca" className="text-primary hover:underline">Segurança e Crianças</Link>
        <span className="hidden sm:inline">·</span>
        <span>Privacidade: <a className="text-primary" href="mailto:privacidade@trocacopa.com">privacidade@trocacopa.com</a></span>
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

function TableCard({ rows }: { rows: { dado: string; finalidade: string; base: string }[] }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border mt-2">
      <div className="grid grid-cols-[1fr_1.5fr_1.5fr] bg-surface text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-3 py-2 gap-2">
        <span>Dado</span>
        <span>Finalidade</span>
        <span>Base legal (LGPD)</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className={`grid grid-cols-[1fr_1.5fr_1.5fr] px-3 py-2.5 gap-2 text-[11px] leading-snug ${i % 2 === 0 ? "" : "bg-surface/40"}`}>
          <span className="font-semibold">{r.dado}</span>
          <span className="text-foreground/80">{r.finalidade}</span>
          <span className="text-muted-foreground">{r.base}</span>
        </div>
      ))}
    </div>
  );
}
