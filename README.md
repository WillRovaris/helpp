# Helpp

App de pesquisa de preços a partir de notas fiscais (NFC-e). MVP focado em
**Santa Catarina**. Ver [DECISIONS.md](./DECISIONS.md) para as decisões de
arquitetura e riscos técnicos conhecidos.

## Estrutura

- `apps/api` — backend (Fastify + TypeScript + Prisma/Postgres)
- `apps/mobile` — app (Expo / React Native + TypeScript)

## Como rodar localmente

### 1. Backend

```bash
cd apps/api
cp .env.example .env    # preencha DATABASE_URL e DIRECT_URL com as do Supabase
npm run prisma:migrate  # só na primeira vez / após mudar o schema
npm run dev              # sobe em http://localhost:3333
```

### 2. App mobile

```bash
cd apps/mobile
npm start
```

Abra no Expo Go (celular físico) ou num emulador Android/iOS.

**Endereço da API** (`apps/mobile/src/api/client.ts`):
- Sem `apps/mobile/.env`: usa `10.0.2.2` (emulador Android) ou `localhost` (iOS simulator/web).
- Com `EXPO_PUBLIC_API_URL` definido em `apps/mobile/.env` (copie de `.env.example`):
  usa essa URL — é assim que o app aponta pra API já publicada na Vercel, inclusive
  num celular físico fora da sua rede.

## Deploy (Supabase + Vercel) — já no ar

API pública: **https://preco-certo-api-will-rovaris-projects.vercel.app**
Banco: projeto Supabase `preco-certo` (região `sa-east-1`, São Paulo).

Ver [DECISIONS.md](./DECISIONS.md) #3 e #3b para o porquê de cada escolha.

Feito sem GitHub — o deploy foi direto do código local pra Vercel (plugin MCP
`deploy_to_vercel`), já que a integração do plugin do GitHub não conectou
(erro de formatação do header de autorização). Isso significa que **um novo
deploy não acontece sozinho a cada mudança** — precisa rodar de novo manualmente
(ou conectar o GitHub depois para deploy automático).

### Redeploy manual após mudanças no backend
Sem GitHub conectado ainda, um redeploy = rodar de novo o mesmo fluxo que gerou
o deploy atual (upload direto dos arquivos de `apps/api` via Vercel). Peça pra
IA repetir o deploy, ou configure `vercel login` + `vercel --prod` localmente.

### Variáveis de ambiente já configuradas na Vercel
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` — em Settings → Environment Variables
do projeto `preco-certo-api`. `COSMOS_API_KEY` ficou de fora (opcional).

### Rodando migrations futuras contra o Supabase
```bash
cd apps/api
npm run prisma:migrate   # gera + aplica uma nova migration em dev
# depois, para aplicar a mesma migration no banco de produção (é o mesmo banco por enquanto):
npm run prisma:deploy
```

## Fluxo do MVP

1. Criar conta / login.
2. Tocar em "Escanear nota fiscal" → câmera lê o QR Code da NFC-e.
3. Abre uma WebView com a página de consulta pública da SEFAZ-SC. Se aparecer
   captcha, o usuário resolve normalmente (uma vez, como faria no navegador).
4. Ao ver os produtos da nota carregados na WebView, toca em "Importar esta nota".
5. O HTML renderizado é enviado para a API, que extrai produtos/preços/estabelecimento,
   evita duplicidade pela chave de acesso, normaliza os nomes e grava o histórico de preços.
6. Tela de confirmação mostra o resultado; a partir daí dá pra pesquisar qualquer
   produto e comparar preços entre estabelecimentos.

## O que falta validar com uma nota real

O parser de SC (`apps/api/src/fiscal/providers/sc.provider.ts`) foi construído
sem acesso a uma página de resultado real (sem chave de NFC-e válida disponível
durante o desenvolvimento — ver DECISIONS.md #2). A lógica foi testada com HTML
sintético equivalente ao formato esperado, mas os seletores/heurísticas de
extração **precisam ser conferidos e ajustados assim que alguém escanear uma
nota real de Santa Catarina**. Se o parsing falhar, a API retorna um erro
amigável em vez de quebrar — é o sinal de que o parser precisa de ajuste.

## Próximos passos sugeridos

- Validar o parser de SC com uma nota real e ajustar os seletores.
- Enriquecimento de produto por GTIN via Cosmos (precisa de `COSMOS_API_KEY`).
- Tela de correção manual de item não identificado (seção 20 do briefing original).
- Conectar o GitHub (plugin com erro de configuração) para deploy automático.
- Habilitar RLS nas tabelas do Supabase (ver aviso em DECISIONS.md).
- Adicionar um segundo estado (o adapter novo entra em `fiscal/registry.ts`).
