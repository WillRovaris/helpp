# Decisões de arquitetura — MVP

Registro das decisões tomadas para não travar o desenvolvimento em pontos não essenciais.
Cada uma pode ser revisada depois, mas foi escolhida deliberadamente para o MVP.

## 1. Estado inicial: Santa Catarina (SC)
A consulta pública da NFC-e não tem API nacional única — cada SEFAZ tem sua própria URL
e formato de página. Construir adapters para os 27 estados de uma vez não é um MVP.
`FiscalDataProvider` é uma interface; `SCProvider` é a primeira implementação.
Adicionar um novo estado = criar um novo provider e registrá-lo em `fiscal/registry.ts`.

## 2. Acesso aos dados da nota: WebView no app + parsing server-side (HTML), não XML oficial
A SEFAZ não expõe o XML completo da NFC-e por download público (o serviço `DistribuicaoDFe`
não cobre NFC-e). O único acesso sem certificado digital é a página HTML de consulta pública.

**Teste real feito em 13/09/2026** (`curl` direto contra `sat.sef.sc.gov.br/nfce/consulta?p=...`,
inclusive com o parâmetro completo do QR Code): a premissa inicial ("o link do QR carrega
direto, sem captcha") **estava errada para SC**. Toda requisição — via chave digitada ou via
parâmetro `p` do QR — é redirecionada para um gate `SecurityVerify.aspx` que apresenta um
campo de Captcha. Isso é típico de sistemas ASP.NET WebForms com proteção anti-bot; não dá
para confirmar sem um cliente com JS real se esse gate é sempre exibido ou só sob suspeita
de automação (curl não executa JS nem mantém handshake de cookies).

**Decisão**: o fetch da página NÃO acontece no backend. O app mobile abre a URL da consulta
em uma **WebView** (mesmo contexto de um navegador real — cookies, JS, e o usuário resolve o
captcha manualmente se ele aparecer, uma única vez por nota). Quando a página de resultado
carrega, o app injeta JS na WebView para capturar `document.documentElement.outerHTML` e
envia esse HTML para o backend, que faz o parsing (`SCProvider.parseHtml`). Isso mantém a
lógica de parsing centralizada e atualizável sem depender de release de app, e evita construir
qualquer mecanismo de bypass de captcha (fora de escopo e potencialmente contra os termos da
SEFAZ). `FiscalDataProvider` deixa de ter um método de fetch e passa a só parsear HTML recebido.

**Confirmado em 15/09/2026 com nota real** (KOCH HIPERMERCADO, Tubarão/SC): o parser foi
reescrito com os seletores reais (`#tabResult`, `.txtTit`, `.Rqtd`, `.RvlUnit`, `.valor`,
`#totalNota`) e extraiu corretamente os 9 itens, quantidades, CNPJ, endereço e valor pago.

**Limite de requisições da SEFAZ-SC**: o sistema deles tem um bloqueio anti-abuso por IP
("número excessivo de requisições deste IP... aguarde alguns minutos"). Isso derrubou o
acesso depois de várias consultas seguidas (testes manuais + uso real no app, mesmo IP de
rede doméstica). Implicações: (1) não fazer testes automatizados repetidos contra o site
real da SEFAZ fora do fluxo do usuário; (2) o app deveria eventualmente tratar essa mensagem
de bloqueio como um caso conhecido (hoje cai no erro genérico de parsing, já que a página diz
"Aplicativo temporariamente indisponível" em vez de mostrar a nota) — ficou como próximo passo.

**Risco em aberto**: como nunca vimos a página de resultado real (não temos uma chave válida
para passar do captcha), os seletores em `sc.provider.ts` são heurísticos — baseados em padrões
comuns de portais de consulta fiscal (rótulo + valor por texto, não por classe CSS específica).
Precisam ser validados e ajustados assim que o primeiro usuário escanear uma nota real.
Enquanto isso, se o parsing falhar, o HTML bruto é preservado (`Receipt.rawData`) e a nota é
marcada para revisão manual em vez de ser descartada (mesmo espírito da seção 20 do briefing).

## 3. Banco de dados: Postgres via Supabase (atualizado — era SQLite local)
Decisão original era SQLite em dev (sem Docker disponível) e Postgres só em produção.
Mudou ao decidir hospedar a API na Vercel logo no MVP: sem servidor próprio rodando o
tempo todo, não dá pra manter SQLite em arquivo entre invocações da função serverless.
Passou a usar Postgres do Supabase também em desenvolvimento — um único banco por enquanto,
sem banco local separado. `DATABASE_URL` aponta para o pooler (pgbouncer, porta 6543,
necessário porque funções serverless abrem/fecham conexões com muita frequência) e
`DIRECT_URL` para a conexão direta (porta 5432), usada só por `prisma migrate`.

## 3b. Hospedagem da API: Vercel (função serverless), não um servidor Node tradicional
O Fastify original rodava com `.listen()` (processo sempre ativo). Para rodar na Vercel,
a criação do app foi separada do `.listen()` (`src/app.ts` exporta `buildApp()`;
`src/index.ts` continua usando `.listen()` só para dev local). `api/index.ts` expõe
esse mesmo app como uma função serverless (`app.server.emit("request", req, res)`).

**Risco conhecido documentado**: Prisma + Vercel + monorepo tem um problema recorrente
de o binário do query engine (`libquery_engine-*.so.node`) ser removido do bundle da
função pelo processo de otimização da Vercel. Mitigado com `binaryTargets` explícito no
schema (`rhel-openssl-3.0.x`) e `includeFiles` no `vercel.json` apontando para
`node_modules/.prisma/client/**`. Se o deploy falhar com erro de "query engine not found",
esse é o primeiro lugar a revisar.

## 4. Preços e quantidades como Float no MVP
Idealmente valores monetários usariam inteiros (centavos) ou `Decimal`. Para o MVP,
Float é suficiente e mais simples; migrar para centavos antes de qualquer lançamento real
para evitar erros de arredondamento acumulados.

## 5. Autenticação própria (JWT + bcrypt), não Supabase
Evita depender de uma conta externa antes mesmo do primeiro `npm install`. Pode migrar
para Supabase/Auth0 depois sem afetar o resto da arquitetura, já que a auth fica isolada
em `src/auth/`.

## 6. Normalização de produtos: baseada em regras no MVP, não IA
`normalizeProduct()` aplica expansão de abreviações comuns (REFR → Refrigerante, UHT, etc.)
e capitalização. Não chama nenhum modelo de IA ainda — fica pronto para plugar depois
sem mudar o contrato (`raw_description` sempre preservado, `normalized_name` é derivado).

## 7. Imagem/enriquecimento de produto por GTIN: stub pronto para Cosmos (Bluesoft)
`productLookup.ts` já separa "buscar na base interna" de "buscar em fonte externa".
A chamada real à API Cosmos fica como TODO com a integração documentada, porque exige
uma chave de API que o usuário ainda não configurou.

## 8. Prevenção de duplicidade
`Receipt.accessKey` tem constraint `unique` no banco — é a chave dos 44 dígitos da NFC-e,
suficiente sozinha para identificar a nota (contém CNPJ, UF, data e número de forma implícita).

## 9. App mobile: Expo (React Native + TypeScript)
Câmera/QR nativo via `expo-camera`, um único código para iOS/Android, deploy simplificado
via EAS. Alternativa (Flutter) descartada só por familiaridade do ecossistema JS do resto do stack.
