import React from "react";
import { ScrollView, Text } from "react-native";
import { Cartao, useEspacoRodape } from "../components/ui";
import { colors, spacing, typography } from "../theme";

// Termos de Uso e Privacidade (rascunho do dono — revisar com advogado antes de vender).
const ATUALIZADO_EM = "25/10/2026";

const SECOES: { titulo: string; texto: string }[] = [
  {
    titulo: "1. O que é o Helpp",
    texto:
      "O Helpp é um aplicativo para organizar as finanças da casa: lançar despesas e entradas, ler notas fiscais, acompanhar cartões, faturas e contas fixas. Ele é uma ferramenta de organização e não oferece consultoria financeira, contábil ou de investimentos.",
  },
  {
    titulo: "2. Sua conta",
    texto:
      "Para usar o Helpp você cria uma conta com e-mail e senha. Você é responsável por manter sua senha em segredo e pelas informações que lança no aplicativo. Se perceber uso indevido da sua conta, troque a senha em Configurações → Perfil e fale com a gente.",
  },
  {
    titulo: "3. Quais dados guardamos",
    texto:
      "• Cadastro: nome, e-mail e, se você informar, telefone.\n• Finanças: despesas, entradas, cartões, contas fixas, notas fiscais lidas (com os itens comprados) e arquivos de extrato/fatura importados (guardamos os lançamentos e o nome do arquivo, não o arquivo em si).\n• Sugestões que você enviar, com a versão do app e o modelo do celular.\n\nNão pedimos nem guardamos senhas de banco, números completos de cartão ou dados para pagamento.",
  },
  {
    titulo: "4. Para que usamos",
    texto:
      "Usamos seus dados para o aplicativo funcionar (mostrar seus lançamentos, sincronizar entre celulares, lembretes), para responder sugestões e pedidos de suporte e para melhorar o Helpp. Só enviamos novidades por e-mail ou WhatsApp se você autorizar no seu Perfil — e você pode desligar quando quiser. Não vendemos seus dados.",
  },
  {
    titulo: "5. Quem vê seus dados",
    texto:
      "Os dados da casa são vistos só por quem faz parte dela (por exemplo, o casal que compartilha a casa). Compartilhar é opcional e depende de convite. Os dados ficam guardados com segurança em servidores do Supabase, nosso provedor de banco de dados, e são enviados a ele de forma criptografada.",
  },
  {
    titulo: "6. Cuidados ao usar",
    texto:
      "Os totais, sobras e avisos são calculados a partir do que é lançado ou importado. A leitura automática de notas fiscais e extratos pode ter erros: confira os valores antes de tomar decisões. O Helpp não se responsabiliza por decisões tomadas com base em informações incompletas ou incorretas.",
  },
  {
    titulo: "7. Seus direitos (LGPD)",
    texto:
      "Você pode pedir a qualquer momento para ver, corrigir, levar para outro lugar ou apagar seus dados, e retirar autorizações dadas. Basta escrever para helppsuporte@gmail.com. Pedidos de exclusão da conta apagam seus dados pessoais e os lançamentos da casa quando você for a única pessoa nela.",
  },
  {
    titulo: "8. Mudanças nestes termos",
    texto:
      "Podemos atualizar estes termos para acompanhar novidades do aplicativo ou da lei. Quando a mudança for importante, avisaremos no aplicativo. Continuar usando o Helpp depois do aviso significa que você concorda com a nova versão.",
  },
  {
    titulo: "9. Contato",
    texto: "Dúvidas, sugestões ou pedidos sobre seus dados: helppsuporte@gmail.com",
  },
];

export function TermosScreen() {
  const rodape = useEspacoRodape();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Text style={typography.label}>Termos de Uso e Privacidade · atualizado em {ATUALIZADO_EM}</Text>
      {SECOES.map((s) => (
        <Cartao key={s.titulo}>
          <Text style={[typography.body, { fontWeight: "700", marginBottom: spacing.xs }]}>{s.titulo}</Text>
          <Text style={[typography.body, { fontSize: 14, lineHeight: 21, color: colors.textSecondary }]}>{s.texto}</Text>
        </Cartao>
      ))}
    </ScrollView>
  );
}
