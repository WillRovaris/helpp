# Helpp — contexto para o Claude

App Android de **finanças da casa** (pessoa sozinha ou casal): lançar gastos, ler NFC-e, parcelamento,
cartões/faturas, contas fixas com lembretes, importar extrato/fatura (OFX/CSV), resumo no WhatsApp.
Dono: Will (franck.will@gmail.com). Não é programador: fale em **português simples**, explique
o que mudou para quem usa o app, sem jargão.

## Estrutura
- `apps/mobile` — o app (Expo SDK 57 / React Native, TypeScript). **É aqui que tudo acontece.**
- `apps/api` — API antiga (Fastify/Prisma) do app de pesquisa de preços. **Não é usada pelo app atual**; fica só de referência.
- `supabase/` — SQLs numerados. O dono roda cada um **à mão** no Supabase (SQL Editor → Run).
  Já rodados: `01` (tabelas + RLS), `02` (renda), `03` (parcelas + categorias), `04` (importacao_id). `05` (faturas_pagas). `06` (categoria Empréstimo 💸, ícone `cash`), `07` (Igreja ⛪, ícone `church`) — conferir se rodaram.
  SQL novo = novo arquivo `05-...sql`, idempotente (`if not exists`), e pedir para ele rodar.
- O app deve **tolerar** o SQL ainda não ter rodado (ex.: `select("*")` em vez de colunas fixas; mensagem "Falta rodar o SQL 0X").

## Backend
- Supabase projeto "Helpp", ref `tpsytskbvcousydgpnlp`, chave *publishable* em `apps/mobile/src/lib/supabase.ts` (pode ficar no código; segurança é o RLS).
- As tabelas antigas `User`, `Receipt`, `Product`... são da API antiga — **não mexer**.
- Para conferir se um SQL rodou: `curl "https://tpsytskbvcousydgpnlp.supabase.co/rest/v1/<tabela>?select=<coluna>&limit=1" -H "apikey: <publishable>"` (erro 42703 = coluna não existe).
- Tudo pertence a uma `casa`; RLS via `sou_membro(casa_id)`. Funções: `criar_casa`, `entrar_na_casa`, `novo_convite`.

## Publicar mudanças (Expo / EAS, conta `wthor`, projeto `0ea5be43-afaa-4916-910e-d787e5c69321`)
- **Atualização automática (OTA)** — mudanças só de JS/telas/imagens. Chega no celular ao fechar e abrir o app:
  ```
  cd apps/mobile
  npx eas-cli update --branch preview --environment preview --platform android --non-interactive --message "<o que mudou>"
  ```
- **APK novo** — só quando entra módulo nativo novo, permissão, ícone/splash, ou mudança no `app.json` nativo:
  ```
  npx eas-cli build -p android --profile preview --non-interactive --no-wait
  ```
  Ao gerar APK com módulo nativo novo, **suba `version` e `versionCode`** em `app.json` (runtimeVersion = appVersion),
  senão a OTA pode chegar num APK antigo sem o módulo e quebrar. Versão atual: **1.2.0 / versionCode 3**.
- Fora deste PC é preciso estar logado no Expo: `npx eas-cli login`, ou variável de ambiente `EXPO_TOKEN`
  (token criado em expo.dev → Account settings → Access tokens). **Nunca** escrever o token em arquivo do repositório.

## Antes de publicar, sempre
1. `npx tsc --noEmit -p .` (em `apps/mobile`)
2. `npx expo export --platform android --output-dir <pasta temporária>` (confere se empacota)
3. Antes de APK: `npx expo-doctor` (21/21). Cuidado: `@expo/vector-icons` puxou `expo-font` de outro SDK e quebrou o build — por isso o app usa **emojis** como ícones.
4. Lógica pura (datas, fatura, contas, importação, lembretes) fica em arquivos sem React Native
   (`src/lib`, `src/importacao`, `src/lembretes/planejar.ts`) e dá para testar compilando com `tsc --ignoreConfig` e rodando com `node`.
5. Commit em português + `git push` para `main` depois de cada mudança.
6. Expressões regulares: editar com a ferramenta de edição de arquivo, não via `node -e`/heredoc — as barras invertidas (`\D`, `\s`, `\b`) já se perderam assim mais de uma vez. Depois de editar, conferir com `grep -n "replace(/"`.

## Convenções do código
- Textos da interface em português do Brasil; nomes de variáveis em português. Na interface é **"despesa"** (não "gasto"); no código/banco continua `gasto`.
- Tela inicial: um botão "+ Lançar despesa" (atalhos Ler nota / Importar / Conta fixa ficam dentro dele) e "📋 Histórico" no rodapé — pedido do dono.
- Cores: **sempre** `colors.*` / `typography.*` de `src/theme.ts` lidas no render (são getters por causa do tema claro/escuro).
  Não usar cor dentro de `StyleSheet.create` nem em constante no topo do arquivo.
- Formulários usam `TelaFormulario` (`src/components/ui.tsx`) para o teclado não cobrir o campo.
- Valores em dinheiro: campo tipo maquininha (`centavosDoTexto` + `formatarReais`); datas digitadas com `mascaraData`.
- Listas da casa ficam ao vivo com `useListaAoVivo` (`src/data/hooks.ts`: busca + realtime do Supabase).

## Regras de produto (vieram do dono)
- **Compra no cartão conta no mês em que a FATURA VENCE** (`mesDeReferencia` em `src/data/hooks.ts`), não no dia da compra. Os outros gastos contam no dia.
- Importar fatura com "Parcela 3/5" lança a 3 e cria a 4 e a 5 nas faturas seguintes (mesmo `parcelamento_id`); na próxima importação a 4/5 é reconhecida e vem desmarcada.
- Fatura pode ser marcada como paga (`faturas_pagas`): some o aviso ⏰, libera o limite e para o lembrete.
- **Compartilhar é opcional**: o app tem que funcionar 100% para quem mora sozinho; convite só na tela "Compartilhar".
- Tema: escolha da pessoa em Configurações (igual ao celular / claro / escuro).
- Bancos dele: cartões Nubank, Digio, C6, Banco do Brasil; contas BB, Caixa, Bradesco, Nubank, C6, Digio.
  A importação lê OFX, CSV, Excel (xlsx/xls/xls-HTML via `xlsx` em `planilha.ts`) e PDF (texto extraído com pdf.js do cdnjs numa WebView escondida — `PdfTexto.tsx` — e interpretado por `lerLinhasPDF`; pede senha se o PDF tiver). Se um arquivo real não ler, ajustar o leitor com o cabeçalho/linhas dele.
  Confirmados com arquivo real: fatura Nubank (CSV), extrato Bradesco (CSV com colunas Crédito/Débito separadas), extrato Nubank PJ em PDF (data como título do dia + "Total de entradas/saídas").
  Pix para o mesmo nome que mandou dinheiro para a conta no arquivo = transferência entre contas da pessoa (vem desmarcado).
- Importação de extrato: Pix vira só "PIX - Nome de quem recebeu" (`nomeDoPix` em `src/importacao/preparar.ts`) — pedido do dono.
- NFC-e: leitura no próprio celular via WebView da SEFAZ-SC (`src/fiscal/nfce.ts`); outros estados podem não funcionar.

## Ideias combinadas para depois
- Publicar na Google Play (teste interno) para atualizações de APK automáticas.
- PDF de extrato ainda não é aceito.
