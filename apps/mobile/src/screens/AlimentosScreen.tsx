import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Barra } from "../components/ResumoMes";
import { Botao, Cartao, Chip, estiloInput, useEspacoRodape } from "../components/ui";
import { useComprasPorGrupo, useTiposDeProduto } from "../data/hooks";
import { idDeTexto } from "../importacao/historico";
import { somarMeses } from "../lib/fatura";
import { hojeISO, MESES, somarDias } from "../lib/format";
import { GRUPOS, type ProdutoDoGrupo, type ResumoGrupo } from "../lib/gruposAlimento";
import { mesAnterior } from "../lib/saldo";
import { linhas } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Alimentos">;

// "30 dias", "3 meses" e "1 ano" contam para trás a partir de hoje; "Por mês" anda mês a mês.
type Periodo = "30d" | "mes" | "3m" | "1a";
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Por mês" },
  { id: "3m", rotulo: "3 meses" },
  { id: "1a", rotulo: "1 ano" },
];
const dataCurta = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5) + "/" + iso.slice(2, 4);

const EMOJIS_TIPO = ["🛍️", "🍕", "🍝", "🥫", "🍯", "🥜", "🐟", "🍗", "🧊", "🧃", "🐶", "🐱", "👶", "🍼", "🧻", "🕯️"];

const proximoMes = (m: string) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// O que mais compramos: compras do mercado por tipo (proteínas, frutas, frios...). Tocar no tipo abre
// os produtos; tocar no produto corrige o tipo, e a correção vale para as notas antigas e as próximas.
export function AlimentosScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { casa } = useCasa();
  const mesAtual = hojeISO().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [aberto, setAberto] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<ProdutoDoGrupo | null>(null);
  /** Formulário "+ Novo tipo" aberto (sozinho ou no meio da correção de um produto). */
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [nomeTipo, setNomeTipo] = useState("");
  const [emojiTipo, setEmojiTipo] = useState(EMOJIS_TIPO[0]);
  const [tipoAlimento, setTipoAlimento] = useState(true);
  const hoje = hojeISO();
  const de = periodo === "mes" ? `${mes}-01` : periodo === "30d" ? somarDias(hoje, -29) : somarDias(somarMeses(hoje, periodo === "3m" ? -3 : -12), 1);
  const ate = periodo === "mes" ? `${mes}-31` : hoje;
  const { alimentos, outros, totalAlimentos, total } = useComprasPorGrupo(de, ate);
  const { tipos } = useTiposDeProduto();

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  const maior = Math.max(...[...alimentos, ...outros].map((g) => g.total), 1);

  function escolherGrupo(grupo: string) {
    if (!casa || !corrigindo) return;
    const existente = linhas("produto_grupos").find((c) => c.chave === corrigindo.chave);
    if (existente) atualizar("produto_grupos", String(existente.id), { grupo });
    // id tirado do nome: se os dois celulares corrigirem o mesmo produto, é o mesmo registro.
    else inserir("produto_grupos", { id: idDeTexto(`${casa.id}|${corrigindo.chave}`), casa_id: casa.id, chave: corrigindo.chave, grupo });
    setCorrigindo(null);
  }

  function fecharModal() {
    setCorrigindo(null);
    setCriandoTipo(false);
    setNomeTipo("");
  }

  function salvarTipo() {
    const nome = nomeTipo.trim();
    if (!casa) return;
    if (!nome) return Alert.alert("Nome", "Dê um nome ao tipo (ex.: Comida de pet, Congelados).");
    if ([...GRUPOS, ...tipos].some((t) => t.nome.toLowerCase() === nome.toLowerCase())) return Alert.alert("Nome repetido", `Já existe o tipo "${nome}".`);
    const novo = inserir("produto_tipos", { casa_id: casa.id, nome: nome.slice(0, 40), emoji: emojiTipo, alimento: tipoAlimento });
    if (corrigindo) escolherGrupo(String(novo.id));
    fecharModal();
  }

  const linhaGrupo = (g: ResumoGrupo, base: number) => (
    <View key={g.id} style={{ paddingVertical: spacing.xs + 2 }}>
      <TouchableOpacity onPress={() => setAberto(aberto === g.id ? null : g.id)} activeOpacity={0.8}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <Text style={[typography.body, { flexShrink: 1 }]} numberOfLines={1}>
            {g.emoji} {g.nome}
          </Text>
          <Text style={typography.body}>
            <Text style={{ fontWeight: "600" }}>{mostrarValor(g.total)}</Text>
            <Text style={typography.label}>  {base > 0 ? Math.round((g.total / base) * 100) : 0}%</Text>
          </Text>
        </View>
        <Barra fracao={g.total / maior} cor={colors.accent} />
      </TouchableOpacity>
      {aberto === g.id && (
        <View style={{ marginTop: spacing.xs }}>
          {g.produtos.map((p) => (
            <TouchableOpacity
              key={p.chave}
              onPress={() => setCorrigindo(p)}
              accessibilityLabel={`Mudar o tipo de ${p.nome}`}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontSize: 14 }]} numberOfLines={2}>
                  {p.nome}
                </Text>
                <Text style={typography.label}>
                  {p.vezes} {p.vezes === 1 ? "compra" : "compras"} · tocar para mudar o tipo
                </Text>
              </View>
              <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm }]}>{mostrarValor(p.total)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "center", flexWrap: "wrap" }}>
        {PERIODOS.map((p) => (
          <Chip key={p.id} rotulo={p.rotulo} ativo={periodo === p.id} onPress={() => setPeriodo(p.id)} />
        ))}
      </View>
      {periodo === "mes" ? (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => setMes(mesAnterior(mes))} hitSlop={10} accessibilityLabel="Mês anterior" style={{ padding: spacing.sm }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>‹</Text>
        </TouchableOpacity>
        <Text style={[typography.body, { fontWeight: "700" }]}>{`${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`}</Text>
        <TouchableOpacity onPress={() => setMes(proximoMes(mes))} disabled={mes >= mesAtual} hitSlop={10} accessibilityLabel="Próximo mês" style={{ padding: spacing.sm, opacity: mes >= mesAtual ? 0.3 : 1 }}>
          <Text style={{ fontSize: 24, color: colors.accent }}>›</Text>
        </TouchableOpacity>
      </View>
      ) : (
        <Text style={[typography.body, { fontWeight: "700", textAlign: "center" }]}>De {dataCurta(de)} até hoje</Text>
      )}

      <Cartao>
        <Text style={typography.label}>🍽️ GASTO COM ALIMENTOS</Text>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(totalAlimentos)}</Text>
        <Text style={typography.label}>de {mostrarValor(total)} comprados no mercado com nota lida</Text>
      </Cartao>

      {total === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Nenhuma nota de mercado neste período. Ao ler uma nota, os produtos entram aqui separados por tipo automaticamente.</Text>}

      {alimentos.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>ALIMENTOS · toque para ver os produtos</Text>
          {alimentos.map((g) => linhaGrupo(g, totalAlimentos))}
        </Cartao>
      )}
      {outros.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>OUTRAS COMPRAS DO MERCADO</Text>
          {outros.map((g) => linhaGrupo(g, total))}
        </Cartao>
      )}

      <Chip rotulo="+ Novo tipo" ativo={false} onPress={() => setCriandoTipo(true)} />

      <Modal visible={!!corrigindo || criandoTipo} transparent animationType="fade" onRequestClose={fecharModal}>
        <Pressable onPress={fecharModal} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: rodape, gap: spacing.md }}>
            {!!corrigindo && <Text style={[typography.body, { fontWeight: "700" }]}>{corrigindo.nome}</Text>}
            {criandoTipo ? (
              <>
                <Text style={typography.label}>NOVO TIPO DE PRODUTO</Text>
                <TextInput value={nomeTipo} onChangeText={setNomeTipo} placeholder="Ex.: Comida de pet, Congelados" placeholderTextColor={colors.textSecondary} autoCapitalize="sentences" maxLength={40} style={estiloInput()} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {EMOJIS_TIPO.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setEmojiTipo(e)}
                      accessibilityLabel={`Ícone ${e}`}
                      style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: emojiTipo === e ? colors.accent : "transparent", backgroundColor: colors.surface }}
                    >
                      <Text style={{ fontSize: 20 }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Chip rotulo="🍽️ É alimento" ativo={tipoAlimento} onPress={() => setTipoAlimento(true)} />
                  <Chip rotulo="🧺 Não é alimento" ativo={!tipoAlimento} onPress={() => setTipoAlimento(false)} />
                </View>
                <Botao titulo="Salvar tipo" onPress={salvarTipo} />
              </>
            ) : (
              <>
                <Text style={typography.label}>QUAL É O TIPO DESTE PRODUTO? VALE PARA TODAS AS COMPRAS DELE.</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {[...GRUPOS.filter((g) => g.id !== "outros"), ...tipos].map((g) => (
                    <Chip key={g.id} rotulo={`${g.emoji} ${g.nome}`} ativo={false} onPress={() => escolherGrupo(g.id)} />
                  ))}
                  <Chip rotulo="+ Novo tipo" ativo={false} onPress={() => setCriandoTipo(true)} />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
