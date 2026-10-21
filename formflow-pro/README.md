# FormFlow Pro

Editor de formulários com ramificações, pontuação, consentimento, relatórios de funil, Pixel/CAPI e servidor MCP.

## Infraestrutura

- Vercel: Next.js, autenticação Supabase e API do aplicativo.
- Supabase: Postgres em esquema privado, Auth, Storage privado e Edge Function autenticada para acesso do servidor.
- Sites: acesso existente com ChatGPT e o mesmo banco Supabase após migração automática. O servidor MCP existente continua no endereço original.
- GitHub: pasta formflow-pro no repositório cnt; a Vercel acompanha main.

A adaptação da API D1 usa transações Postgres por lote para preservar concorrência otimista e idempotência. O papel formflow_app acessa somente as tabelas do aplicativo. As funções de consulta são executáveis apenas pelo service_role, mantido dentro do Supabase. A chave compartilhada do gateway fica nos ambientes dos servidores e nunca no navegador.

## Acesso

O administrador autenticado pelo ChatGPT pode abrir Configurações → Acessar versão Vercel / definir senha. O convite dura uma hora e só pode ser utilizado uma vez. A senha é definida pelo próprio usuário. Cadastros públicos não ganham acesso ao workspace. Para membros, adicione o e-mail à equipe e solicite GET /api/access-link?email=... como administrador; o retorno contém o link individual, que deve ser compartilhado privadamente pelo administrador.

## Variáveis

SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, FORMFLOW_GATEWAY_KEY, FORMFLOW_DATA_BACKEND=supabase, APP_OWNER_USER_ID, APP_OWNER_EMAIL, DATA_ENCRYPTION_KEYS (JSON com a chave v2), DATA_ENCRYPTION_ACTIVE_VERSION=v2, FORMFLOW_EXTERNAL_URL e CRON_SECRET.

Somente na Vercel: FORMFLOW_PLATFORM=supabase. O Sites preserva DATA_ENCRYPTION_KEY legado para a leitura da origem durante a migração. Nunca versionar valores das variáveis.

## Desenvolvimento e validação

pnpm install --frozen-lockfile
pnpm run build (Sites)
node tests/flow.test.mjs
node tests/funnel.test.mjs
node scripts/test-worker.mjs tests/api.test.mjs
node scripts/test-worker.mjs tests/settings.test.mjs
node scripts/test-worker.mjs tests/mcp.test.mjs
pnpm run build:vercel (Vercel)

Execute os dois builds sequencialmente: ambos produzem metadados .next. Não execute testes com dados de produção.

## Métricas

O funil é calculado no servidor para sessões iniciadas no período. A tabela diferencia chegada, resposta, avanço, regra de desqualificação, abandono após 30 minutos, erros e qualificação final. Detalhes anteriores à atualização não são inventados. Barreiras detectadas no navegador são identificadas separadamente das verificadas no envio. Clique no WhatsApp não confirma conversa ou venda. Relatórios acima de 100 mil sessões são sinalizados para reduzir o período.

Meta: FormComplete registra envios, Lead registra somente leads qualificados por padrão, QualifiedLead registra aprovação e WhatsAppClick registra o clique. A política de Lead pode incluir todos os envios no editor. Eventos de marketing dependem de consentimento; Pixel e CAPI compartilham event_id. A CAPI exige token real configurado em Configurações. Webhooks e e-mails também exigem suas credenciais. As entregas são persistidas, tentadas após a resposta e reprocessadas pelo cron diário ou pelo painel.

Os painéis históricos abaixo do funil indicam que usam os registros carregados. O funil detalhado usa paginação independente no servidor.

## Migração

Ao ativar FORMFLOW_DATA_BACKEND=supabase no Sites, o servidor copia os registros, sessões, membros, entregas e arquivos do D1/R2 para o Supabase antes da primeira operação. Dados sensíveis são recriptografados como v2. A origem é preservada e uma marca de conclusão impede repetir a migração. O destino é fixo nas variáveis do servidor; nenhum solicitante pode escolher outro endereço ou obter os dados da migração. Novas gravações passam ao banco compartilhado. Faça backup antes de qualquer alteração futura da estrutura.

## Limitações operacionais

Este aplicativo oferece um workspace com equipe e permissões. Um painel de revenda com isolamento de múltiplas empresas exige implementação adicional. O acesso MCP na Vercel aceita uma sessão ou bearer token Supabase validado; a instalação nativa do plugin usa o endpoint Sites. OAuth de terceiros e integrações comerciais precisam de credenciais válidas dos respectivos provedores.
