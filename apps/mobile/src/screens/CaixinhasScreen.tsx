import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Barra } from "../components/ResumoMes";
import { Botao, Cartao, IconeCategoria, useEspacoRodape } from "../components/ui";
import { useCaixinhas } from "../data/hooks";
import { planoCaixinha } from "../lib/caixinhas";
import { hojeISO } from "../lib/format";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Caixinhas">;

// Caixinhas: dinheiro guardado para objetivos (viagem, reserva de emergência...).
export function CaixinhasScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { caixinhas, totalGuardado } = useCaixinhas();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={typography.label}>🐷 TOTAL GUARDADO</Text>
        <Text style={{ fontSize: 32, fontWeight: "700", color: colors.accent }}>{mostrarValor(totalGuardado)}</Text>
        <Text style={typography.label}>
          {caixinhas.length} {caixinhas.length === 1 ? "caixinha" : "caixinhas"}
        </Text>
      </Cartao>

      {caixinhas.length === 0 && (
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          Crie uma caixinha para cada objetivo — viagem, reserva de emergência, carro novo — e vá guardando aos poucos. O app mostra quanto falta e quanto guardar por mês.
        </Text>
      )}

      {caixinhas.map((c) => {
        const p = planoCaixinha(c.saldo, c.meta, c.data_alvo, hojeISO());
        return (
          <TouchableOpacity key={c.id} onPress={() => navigation.navigate("Caixinha", { caixinhaId: c.id })} activeOpacity={0.8}>
            <Cartao>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconeCategoria categoria={{ icone: c.emoji, cor: c.cor }} tamanho={44} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: "700" }]}>{c.nome}</Text>
                  <Text style={typography.label}>
                    {mostrarValor(c.saldo)}
                    {c.meta ? ` de ${mostrarValor(c.meta)}` : ""}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
              </View>
              {p.progresso != null && (
                <View style={{ marginTop: spacing.sm }}>
                  <Barra fracao={p.progresso} cor={c.cor} />
                  <Text style={[typography.label, { marginTop: 2 }]}>
                    {p.falta === 0
                      ? "🎉 Meta alcançada!"
                      : `${Math.round(p.progresso * 100)}% · faltam ${mostrarValor(p.falta ?? 0)}${p.porMes ? ` · guarde ${mostrarValor(p.porMes)}/mês` : ""}`}
                  </Text>
                </View>
              )}
            </Cartao>
          </TouchableOpacity>
        );
      })}

      <Botao titulo="+ Nova caixinha" onPress={() => navigation.navigate("CaixinhaForm", {})} />
    </ScrollView>
  );
}
