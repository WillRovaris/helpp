# Helpp

App Android de finanças da casa — para quem mora sozinho ou para casais (os dois veem tudo ao vivo).

- Lançar gastos rápido (valor, categoria, forma de pagamento, parcelado)
- Ler a nota fiscal (NFC-e) pelo QR Code e guardar os itens
- Resumo do mês por categoria, renda e "quanto sobra", envio no WhatsApp
- Cartões: fatura aberta, fatura a vencer e "faltam R$ X" do limite
- Contas fixas com vencimento, "Paguei" e lembretes no celular
- Importar extrato da conta ou fatura do cartão (OFX/CSV)

## Estrutura
- `apps/mobile` — o app (Expo / React Native + TypeScript), fala direto com o Supabase
- `supabase/` — scripts SQL do banco, rodados em ordem no SQL Editor do Supabase
- `apps/api` — API da versão antiga (pesquisa de preços); não é usada pelo app atual

## Rodar e publicar
```bash
npm install                 # na raiz (npm workspaces)
cd apps/mobile
npx expo start              # desenvolvimento
npx eas-cli login           # uma vez por computador
```
Publicação de atualizações e APK: ver [CLAUDE.md](./CLAUDE.md).

A versão antiga (pesquisa de preços com API na Vercel) está guardada na tag `v0-preco-certo`.
