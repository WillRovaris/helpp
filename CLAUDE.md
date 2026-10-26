# Helpp — contexto para o Claude

App Android de **finanças da casa** (pessoa sozinha ou casal): lançar gastos, ler NFC-e, parcelamento,
cartões/faturas, contas fixas com lembretes, importar extrato/fatura (OFX/CSV), resumo no WhatsApp.
Dono: Will (franck.will@gmail.com). Não é programador: fale em **português simples**, explique
o que mudou para quem usa o app, sem jargão.

## Estrutura
- `apps/mobile` — o app (Expo SDK 57 / React Native, TypeScript). **É aqui que tudo acontece.**
- `apps/api` — API antiga (Fastify/Prisma) do app de pesquisa de preços. **Não é usada pelo app atual**; fica só de referência.
- `supabase/` — SQLs numerados. O dono roda cada um **à mão** no Supabase (SQL Editor → Run).
  Já rodados: `01` (tabelas + RLS), `02` (renda), `03` (parcelas + categorias), `04` (importacao_id). `05` (faturas_pagas). `06` (categoria Empréstimo 💸, ícone `cash`), `07` (Igreja ⛪, ícone `church`), `08` (gastos.data_pagamento + correção dos lançamentos manuais no cartão), `09` (contas_fixas.inicio + meses), `10` (sincronização: updated_at em todas as tabelas + tabela `exclusoes`). `11` (sugestoes), `12` (casas.rendas — renda de cada pessoa). `13` (casas.saldos_iniciais), `14` (receitas). `15` (e-mail das sugestões). `16` (importacoes + contatos), `17` (importacoes.nome). `18` (categorias.limite), `19` (contas_fixas.pago_por), `20` (segurança). Todos rodados até o 20; e-mail das sugestões testado e funcionando (24/10).
  SQL novo = novo arquivo `05-...sql`, idempotente (`if not exists`), e pedir para ele rodar.
- O app deve **tolerar** o SQL ainda não ter rodado (ex.: `select("*")` em vez de colunas fixas; mensagem "Falta rodar o SQL 0X").

## Modo offline (desde a versão 1.3.0)
- O app **lê sempre da cópia no celular** (`src/offline/banco.ts`, SQLite via `expo-sqlite`, carregada em memória) e **grava pelo `src/offline/repo.ts`** (`inserir`, `inserirVarios`, `atualizar`, `excluir`): grava local + entra na fila.
- **Nunca** usar `supabase.from(...)` nas telas. Só `src/offline/sync.ts` (envia a fila e traz o que mudou por `updated_at` + `exclusoes`) e o `CasaContext` (casa/membros e as funções `criar_casa`/`entrar_na_casa`/`novo_convite`, que precisam de internet) falam com a nuvem.
- IDs são gerados no celular (`gerarUuid`). Conflito: vale a última gravação. Pagamento de conta repetido (23505) desfaz a despesa repetida.
- Sincroniza sozinho: ao abrir, ao voltar ao app, a cada minuto, logo após gravar e quando o tempo real avisa. Faixa de status na tela inicial: `StatusSincronizacao.tsx` (novidades de outra pessoa, aguardando internet, sem internet).
- Hooks em `src/data/hooks.ts` usam `useTabela` (lê local e escuta `ouvirMudancas`).
- Sair da conta apaga a cópia local (avisa se houver fila pendente).
- Teste da sincronização: simulação com 2 celulares e nuvem falsa (mock de expo-sqlite + supabase) — 20 cenários; refazer se mexer em `sync.ts`.

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
  senão a OTA pode chegar num APK antigo sem o módulo e quebrar. Versão atual: **1.3.0 / versionCode 4**.
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
- Tela inicial (pedido do dono): total do mês (tocar = Histórico), "+ Lançar despesa" (atalhos Ler nota / Importar / Conta fixa dentro), "💳 Cartões de crédito" (fatura, vencimento, limite ficam lá dentro), contas fixas, categorias e por último "Últimos lançamentos". SEM botão de WhatsApp nem de Histórico no rodapé. Data no lançamento já vem preenchida com hoje (editável).
- Cores: **sempre** `colors.*` / `typography.*` de `src/theme.ts` lidas no render (são getters por causa do tema claro/escuro).
  Não usar cor dentro de `StyleSheet.create` nem em constante no topo do arquivo.
- Formulários usam `TelaFormulario` (`src/components/ui.tsx`) para o teclado não cobrir o campo.
- Toda tela com rolagem usa `paddingBottom: useEspacoRodape()` (botões do Android ficam por cima do app — no S20 FE da Thamara o último item ficava escondido).
- Valores em dinheiro: campo tipo maquininha (`centavosDoTexto` + `formatarReais`); datas digitadas com `mascaraData`.
- Listas da casa ficam ao vivo com `useListaAoVivo` (`src/data/hooks.ts`: busca + realtime do Supabase).

## Regras de produto (vieram do dono)
- **A data informada pela pessoa é a data em que o dinheiro sai** (pedido do dono). Mês da despesa = `data_pagamento` se existir; senão, no cartão, o vencimento da fatura da data da compra (importados/nota); senão, a própria data. Ver `mesDeReferencia` (hooks.ts) e `mesPagamentoCartao` (fatura.ts). No lançamento manual no cartão o campo é "VAI PAGAR EM" (padrão: vencimento da fatura). A fatura de um cartão = tudo dele pago no mês do vencimento.
- Importar fatura com "Parcela 3/5" lança a 3 e cria a 4 e a 5 nas faturas seguintes (mesmo `parcelamento_id`); na próxima importação a 4/5 é reconhecida e vem desmarcada.
- Conta fixa pode ter período (`inicio` + `meses`, ex.: plano de saúde 12x): só aparece, avisa e é sugerida na importação dentro do período (`periodoNoMes` em `lib/contas.ts`). Conta fixa tem "QUEM PAGA ESTA CONTA" (`contas_fixas.pago_por`, SQL 19; só aparece para casal): mostra " · 👤 Nome" na lista, vem marcado no "Paguei" e a conta em aberto conta para essa pessoa no "quem pagou". Contas fixas do mês ainda não pagas entram como despesa comum (sem diferenciação — pedido do dono) no total, na lista do Histórico (no dia do vencimento; tocar abre "Paguei"), nas categorias e no WhatsApp: `contasComoDespesas` em `lib/contas.ts`.
- Fatura pode ser marcada como paga (`faturas_pagas`): some o aviso ⏰, libera o limite e para o lembrete.
- **Compartilhar é opcional**: o app tem que funcionar 100% para quem mora sozinho; convite só na tela "Compartilhar".
- Entradas (pedido do dono): tabela `receitas` (SQL 14) — valor, tipo (ícone escolhido num quadro: `TIPOS_RECEITA` em tipos.ts — salário, atividade extra, comissão, bônus, aposta…; SEM categorias), descrição, data, quem recebeu, `recorrente` (repete todo mês do mês da data até `ate` YYYY-MM). Tela inicial: "+ Lançar despesa" e "+ Lançar entrada" lado a lado. Tela "Entradas do mês" (⚙️ ou tocar no resumo) com navegação por mês, a linha "↪️ Sobra de <mês anterior>" (✏️) e a lista. Editar/excluir recorrente que começou antes pergunta "daqui em diante" (fecha a antiga com `ate` e cria nova) ou "todos os meses". A renda antiga (`casas.rendas`/`renda_mensal`) virou "Salário" recorrente uma vez (`data/migrarRendas.ts`, id = user_id para não duplicar).
- Sobra do mês anterior: entradas − despesas (com contas fixas não pagas) + sobra que ele recebeu; **mês anterior sem entradas = zero** (pedido do dono, depois do bug de R$ 1,1 mi: a 1ª versão somava a renda em todos os meses desde a despesa mais antiga). `lib/saldo.ts` + `useSaldoAnterior`; ✏️ corrige (`casas.saldos_iniciais`, SQL 13).
- Configurações (pedido do dono, 25/10): 👤 Perfil (nome — grava também em `membros` —, e-mail só leitura, telefone com máscara, "aceita novidades", 🎨 tema, 🔑 trocar senha via `supabase.auth.updateUser`; funções em `src/perfil/perfil.ts`, precisam de internet) · 🔔 Notificações (lembretes) · lista (Entradas SEM valor, Cartões, Contas fixas, Importar, Compartilhar, Sugestões) · 📜 Termos de Uso (rascunho em `TermosScreen.tsx` — revisar com advogado antes de vender) · Sair. O e-mail NÃO aparece mais solto na tela.
- Contatos/leads: tabela `contatos` (SQL 16, uma linha por usuário, RLS só a própria; trigger em `auth.users` cria a linha com o e-mail em toda conta nova). O dono vê todos no painel do Supabase (Table Editor → contatos).
- Login: frase "Precisa de ajuda? Dá um Helpp aí!", olho na senha (`CampoSenha` em ui.tsx), cadastro pede confirmação de senha.
- Importar (pedido do dono: saber quando refazer a importação): grava cada arquivo em `importacoes` (SQL 16); extrato pede "DE QUAL BANCO" (chips `BANCOS`, pré-marcado por `bancoProvavel` pelo nome do arquivo/leitor), fatura usa o nome do cartão. Tela mostra "ÚLTIMA ATUALIZAÇÃO DE CADA CONTA" ("Extrato Bradesco Will · 25/10/2026 às 14:32 · há 3 dias") e "HISTÓRICO COMPLETO"; tocar numa importação (✏️) dá um nome próprio (`importacoes.nome`, SQL 17), opcionalmente para todas com o mesmo nome; a "última atualização" agrupa pelo nome mostrado. Importações antigas são remontadas pelos gastos com `importacao_id` (mesma pessoa + cartão + minuto), id fixo via `idDeTexto` para não duplicar entre celulares — `src/importacao/historico.ts`. Atalho "Contas fixas" do Lançar despesa abre a LISTA (ContasScreen), que também mostra "TODAS AS CONTAS CADASTRADAS".
- Modo privacidade (pedido do dono): valores em dinheiro começam ESCONDIDOS ("R$ •••••") toda vez que o app abre; olho (imagens `assets/olho-aberto.png` e `olho-fechado.png`, componente `BotaoOlho`, cor pelo tema via tintColor) na tela inicial, no Histórico, em Entradas, nos Cartões (lista e fatura), em Contas fixas e em Importar. Telas de consulta usam `mostrarValor` de `usePrivacidade()` (nunca `formatarReais` direto); formulários e WhatsApp mostram o valor real. Percentuais, nomes e datas sempre visíveis.
- Bancos dele: cartões Nubank, Digio, C6, Banco do Brasil; contas BB, Caixa, Bradesco, Nubank, C6, Digio.
  A importação lê OFX, CSV, Excel (xlsx/xls/xls-HTML via `xlsx` em `planilha.ts`) e PDF (texto extraído com pdf.js do cdnjs numa WebView escondida — `PdfTexto.tsx` — e interpretado por `lerLinhasPDF`; pede senha se o PDF tiver). Se um arquivo real não ler, ajustar o leitor com o cabeçalho/linhas dele.
  Confirmados com arquivo real: fatura Nubank (CSV), extrato Bradesco (CSV com colunas Crédito/Débito separadas), extrato Nubank PJ em PDF (data como título do dia + "Total de entradas/saídas").
  Pix para o mesmo nome que mandou dinheiro para a conta no arquivo = transferência entre contas da pessoa (vem desmarcado).
- Importação de extrato: Pix vira só "PIX - Nome de quem recebeu" (`nomeDoPix` em `src/importacao/preparar.ts`) — pedido do dono.
- Itens da nota fiscal aparecem no Histórico ("🧾 N itens da nota", abre ali mesmo) — o dono quer usar esses dados no futuro. `nota_itens` NÃO tem `created_at` na nuvem (repo não manda). O sync tira coluna desconhecida e reenvia em vez de apagar o registro.
- Sugestões e melhorias (Configurações → 💡): a Thamara (ou quem usa) escreve ideias, a casa toda vê; bolinha vermelha no ⚙️ quando há pendente de outra pessoa; "Enviar lista de pendentes" compartilha o texto para colar aqui no Claude; marcar "✅ Feita" quando publicar. Tabela `sugestoes` (SQL 11). O sync guarda na fila operações de tabela que ainda não existe na nuvem (não apaga).
  E-mail do projeto: **helppsuporte@gmail.com** (dono criou em 24/10; também será o contato de suporte na Google Play). Cada sugestão nova (de qualquer casa) dispara e-mail para ele pelo próprio banco: trigger `avisar_nova_sugestao` (SQL 15) → `pg_net` → API do Resend, com nome/e-mail (de `auth.users`), casa, `versao_app`, `dispositivo`; reply-to = quem sugeriu. A chave do Resend fica no **Vault** do Supabase com o nome `resend_api_key` — o dono cola direto no SQL Editor, nunca no chat/código. Sem domínio próprio o Resend só envia para o e-mail dono da conta (a conta Resend foi/será criada com o helppsuporte). Próximos: tela de admin "Sugestões recebidas" (todas as casas) com status/resposta (colunas `status`, `resposta` já existem) e a pessoa ver a situação da sugestão dela.
- Categorias no app (26/10): ⚙️ → 🏷️ Categorias e chip "+ Nova" no Lançar despesa (`CategoriasScreen`/`CategoriaFormScreen`): nome, ícone (categorias novas guardam o PRÓPRIO emoji em `icone`; as padrão guardam nome como "cart" — `emojiCategoria` entende os dois; editar uma padrão mantém o nome se o emoji não mudar, porque a importação sugere categoria por esse nome), cor, limite. Excluir = `arquivada: true`, movendo antes as despesas/contas fixas para outra categoria escolhida. NÃO precisa mais de SQL para categoria nova.
- Limite por categoria (pedido do dono, 25/10): `categorias.limite` (SQL 18), tela "🎯 Limites por categoria" (Configurações ou "🎯 Limites ›" no quadro CATEGORIA da tela inicial). No quadro, categoria com limite mostra "R$ X de R$ Y", barra verde/amarela (≥80%)/vermelha (>100%) e "restam"/"passou". Ao salvar despesa, `avisoLimite` (lib/limites.ts) avisa quando cruza 80% ou o limite; total do mês igual ao da tela inicial (despesas + contas fixas não pagas) em `data/limites.ts`.
- Preço dos produtos (pedido do dono): "🛒 Preço dos produtos" em Configurações — busca por palavras sem acento nos itens das notas, "onde mais gastaram" (1 mês/3 meses/1 ano) e detalhe do produto (último/menor/médio/maior preço, mercado mais barato, ▲▼ % desde a 1ª compra, cada compra). Lógica pura em `lib/produtos.ts` (mesmo nome normalizado = mesmo produto).
- Fechamento do mês (pedido do dono, 26/10): tela "Fechamento do mês" (`FechamentoScreen`, padrão = mês que acabou, ‹ ›) com sobrou/faltou, entradas, sobra anterior, despesas, ▲▼ vs mês anterior, categorias que passaram do limite, onde mais gastou, 5 maiores despesas, quem pagou e "📤 Enviar resumo no WhatsApp" (`textoResumoMes` agora usa entradas + sobra, não a renda antiga). Abre por: notificação no dia 1 no horário dos lembretes (`lembreteFechamento` em planejar.ts, tela "Fechamento"), faixa "📅 Outubro fechou!" na tela inicial nos dias 1–7 (✕ esconde, meta local) e ⚙️ → 📅 Fechamento do mês. Cálculo em `useResumoDoMes` (hooks.ts).
- NFC-e: leitura no próprio celular via WebView da SEFAZ-SC (`src/fiscal/nfce.ts`); outros estados podem não funcionar.

## Segurança (auditoria de 26/10, pedida pelo irmão do dono — programador)
- O app NÃO é confiável: toda regra de acesso tem que estar no banco (RLS, triggers, funções). Chave publishable no app é ok; service_role/secret NUNCA.
- SQL 20: convite com 8 caracteres (`gerar_codigo_convite`), só gerado em Compartilhar, vence em 48 h, vale uma vez, máx. 5 tentativas/hora (`convite_tentativas`); `entrar_na_casa` devolve NULL para código inválido (app mostra a mensagem). Triggers: `proteger_casa` (app não muda id/código), `proteger_membro` (não troca casa/usuário), `forcar_autor` (created_by = auth.uid()), `validar_mesma_casa` (cartão/categoria/nota/conta/pessoa da mesma casa), `limitar_sugestoes` (20/dia, 2000 letras), `contato_email_da_conta`. Funções: revogadas de anon/public; authenticated só nas 4 RPCs + sou_membro. Tabelas antigas do Prisma: RLS + sem acesso para anon/authenticated. 1 pessoa = 1 casa (índice único).
- App: QR da nota só abre site *.gov.br (`ehEnderecoDoGoverno`), WebViews sem navegação para fora/sem arquivos; pdf.js com `isEvalSupported: false` (CVE-2024-4367); importação limitada a 10 MB; `android.allowBackup: false` (vale no próximo APK).
- Pendente: xlsx 0.18.5 tem CVEs (prototype pollution/ReDoS) — trocar por `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (instalação precisa de aprovação do dono). Hardening futuro: sessão em SecureStore (APK novo), pdf.js 4.x, SRI nos scripts do cdnjs, proteção de senha vazada no Supabase Auth, auditoria completa nos roteiros do irmão.

## Ideias combinadas para depois
- Publicar na Google Play (teste interno) para atualizações de APK automáticas.
- PDF de extrato ainda não é aceito.
