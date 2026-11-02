import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { useComprasPorGrupo, useTiposDeProduto } from "../data/hooks";
import { idDeTexto } from "../importacao/historico";
import { GRUPOS, type ProdutoDoGrupo, type ResumoGrupo } from "../lib/gruposAlimento";
import { linhas } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import { usePrivacidade } from "../privacidade/PrivacidadeContext";
import { colors, spacing, typography } from "../theme";
import { Barra } from "./ResumoMes";
import { Botao, Cartao, Chip, estiloInput, useEspacoRodape } from "./ui";

const EMOJIS_TIPO = ["🛍️", "🍕", "🍝", "🥫", "🍯", "🥜", "🐟", "🍗", "🧊", "🧃", "🐶", "🐱", "👶", "🍼", "🧻", "🕯️"];

// Tipos de Alimentos: compras do mercado de um período (de/ate YYYY-MM-DD) por tipo (proteínas, frutas,
// frios...). Tocar no tipo abre os produtos; tocar no produto corrige o tipo, e a correção vale para as
// notas antigas e as próximas. Usado na tela Tipos de Alimentos e dentro de Compras do mês.
export function TiposDeAlimentos({ de, ate, comTotal }: { de: string; ate: string; comTotal?: boolean }) {
  const rodape = useEspacoRodape();
  const { mostrarValor } = usePrivacidade();
  const { casa } = useCasa();
  const [aberto, setAberto] = useState<string | null>(null);
  const [corrigindo, setCorrigindo] = useState<ProdutoDoGrupo | null>(null);
  /** Formulário "+ Novo tipo" aberto (sozinho ou no meio da correção de um produto). */
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [nomeTipo, setNomeTipo] = useState("");
  const [emojiTipo, setEmojiTipo] = useState(EMOJIS_TIPO[0]);
  const [tipoAlimento, setTipoAlimento] = useState(true);
  const { alimentos, outros, totalAlimentos, total } = useComprasPorGrupo(de, ate);
  const { tipos } = useTiposDeProduto();

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
    <>
      {comTotal && (
        <Cartao>
          <Text style={typography.label}>🍽️ GASTO COM ALIMENTOS</Text>
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>{mostrarValor(totalAlimentos)}</Text>
          <Text style={typography.label}>de {mostrarValor(total)} comprados no mercado com nota lida</Text>
        </Cartao>
      )}

      {total === 0 && <Text style={[typography.body, { color: colors.textSecondary }]}>Nenhuma nota de mercado neste período. Ao ler uma nota, os produtos entram aqui separados por tipo automaticamente.</Text>}

      {alimentos.length > 0 && (
        <Cartao>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>
            {comTotal ? "ALIMENTOS" : `🥗 TIPOS DE ALIMENTOS · ${mostrarValor(totalAlimentos)}`} · toque para ver os produtos
          </Text>
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
    </>
  );
}
