import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Cartao, Chip, useEspacoRodape } from "../components/ui";
import { type ConfigLembretes, lerConfigLembretes, salvarConfigLembretes } from "../lembretes/lembretes";
import { colors, spacing, typography } from "../theme";

// Notificações: lembretes de contas fixas e faturas (ligar/desligar e horário).
export function NotificacoesScreen() {
  const rodape = useEspacoRodape();
  const { casa } = useCasa();
  const [lembretes, setLembretes] = useState<ConfigLembretes | null>(null);

  useEffect(() => {
    lerConfigLembretes().then(setLembretes);
  }, []);

  function mudar(c: ConfigLembretes) {
    setLembretes(c);
    salvarConfigLembretes(c, casa?.id);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      {lembretes && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.xs }]}>🔔 LEMBRETES DE CONTAS E FATURAS</Text>
          <Text style={[typography.label, { marginBottom: spacing.md }]}>Avisa no dia anterior e no dia do vencimento das contas fixas e das faturas dos cartões.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Chip rotulo="Ligados" ativo={lembretes.ativo} onPress={() => mudar({ ...lembretes, ativo: true })} />
            <Chip rotulo="Desligados" ativo={!lembretes.ativo} onPress={() => mudar({ ...lembretes, ativo: false })} />
          </View>
          {lembretes.ativo && (
            <>
              <Text style={[typography.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>HORÁRIO DO AVISO</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {[7, 8, 9, 12, 18, 20].map((h) => (
                  <Chip key={h} rotulo={`${h}h`} ativo={lembretes.hora === h} onPress={() => mudar({ ...lembretes, hora: h })} />
                ))}
              </View>
            </>
          )}
        </Cartao>
      )}

      {lembretes && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.xs }]}>🌙 LEMBRETE PARA LANÇAR AS DESPESAS</Text>
          <Text style={[typography.label, { marginBottom: spacing.md }]}>
            Toda noite: &quot;Lançou as despesas de hoje?&quot;. Não avisa nos dias em que alguém da casa já lançou alguma despesa.
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Chip rotulo="Ligado" ativo={lembretes.noturno} onPress={() => mudar({ ...lembretes, noturno: true })} />
            <Chip rotulo="Desligado" ativo={!lembretes.noturno} onPress={() => mudar({ ...lembretes, noturno: false })} />
          </View>
          {lembretes.noturno && (
            <>
              <Text style={[typography.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>HORÁRIO</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {[19, 20, 21, 22, 23].map((h) => (
                  <Chip key={h} rotulo={`${h}h`} ativo={lembretes.horaNoturno === h} onPress={() => mudar({ ...lembretes, horaNoturno: h })} />
                ))}
              </View>
            </>
          )}
        </Cartao>
      )}
    </ScrollView>
  );
}
