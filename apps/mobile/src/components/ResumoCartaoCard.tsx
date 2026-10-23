import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Cartao as CartaoTipo } from "../data/tipos";
import { diaMes, type ResumoCartao } from "../lib/fatura";
import { colors, spacing, typography } from "../theme";
import { Barra } from "./ResumoMes";
import { Cartao } from "./ui";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";

/** Cor do limite: verde, amarelo a partir de 80% usado, vermelho se estourou. */
export function corLimite(usado: number, limite: number): string {
  if (limite <= 0) return colors.textSecondary;
  const f = usado / limite;
  return f >= 1 ? colors.danger : f >= 0.8 ? colors.warning : colors.accent;
}

export function ResumoCartaoCard({ cartao, resumo, onPress }: { cartao: CartaoTipo; resumo: ResumoCartao; onPress: () => void }) {
  const { mostrarValor } = usePrivacidade();
  const temLimite = cartao.limite > 0;
  const cor = corLimite(resumo.limiteUsado, cartao.limite);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Cartao>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={[typography.body, { fontWeight: "700" }]}>💳 {cartao.nome}</Text>
          <Text style={[typography.label, { color: colors.accent }]}>ver fatura ›</Text>
        </View>

        <Text style={[typography.label, { marginTop: spacing.sm }]}>FATURA ABERTA · fecha {diaMes(resumo.aberta.fechamento)} · vence {diaMes(resumo.aberta.vencimento)}</Text>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(resumo.aberta.total)}</Text>

        {resumo.fechada && (
          <Text style={[typography.label, { color: resumo.fechada.paga ? colors.accent : colors.warning, marginTop: spacing.xs }]}>
            {resumo.fechada.paga
              ? `✅ Fatura de ${mostrarValor(resumo.fechada.total)} (vence ${diaMes(resumo.fechada.vencimento)}) paga`
              : `⏰ Fatura fechada de ${mostrarValor(resumo.fechada.total)} vence ${diaMes(resumo.fechada.vencimento)}`}
          </Text>
        )}

        {temLimite && (
          <View style={{ marginTop: spacing.md }}>
            <Barra fracao={resumo.limiteUsado / cartao.limite} cor={cor} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
              <Text style={typography.label}>Limite {mostrarValor(cartao.limite)}</Text>
              <Text style={[typography.label, { color: cor, fontWeight: "700" }]}>
                {resumo.disponivel >= 0 ? `Faltam ${mostrarValor(resumo.disponivel)}` : `Estourou ${mostrarValor(-resumo.disponivel)}`}
              </Text>
            </View>
          </View>
        )}
      </Cartao>
    </TouchableOpacity>
  );
}
