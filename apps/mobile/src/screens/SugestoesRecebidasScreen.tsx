import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Botao, Cartao, Chip, estiloInput, useEspacoRodape } from "../components/ui";
import { dataISO, rotuloDia } from "../lib/format";
import { carregarRecebidas, responder, rotuloSituacao, SITUACOES, type SituacaoSugestao, type SugestaoRecebida } from "../sugestoes/admin";
import { colors, spacing, typography } from "../theme";

type Filtro = SituacaoSugestao | "abertas" | "todas";

// Sugestões recebidas (só a equipe do Helpp): as ideias de TODAS as casas, com quem mandou, a casa,
// a versão do app e o celular. Tocar abre para mudar a situação e escrever a resposta, que aparece
// para a pessoa na tela de Sugestões dela.
export function SugestoesRecebidasScreen() {
  const rodape = useEspacoRodape();
  const [lista, setLista] = useState<SugestaoRecebida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("abertas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<SituacaoSugestao>("nova");
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await carregarRecebidas();
    setLista(r.lista);
    setErro(r.erro);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(s: SugestaoRecebida) {
    if (aberta === s.id) return setAberta(null);
    setAberta(s.id);
    setSituacao(s.status);
    setResposta(s.resposta ?? "");
  }

  async function salvar(s: SugestaoRecebida) {
    setSalvando(true);
    const e = await responder(s.id, situacao, resposta);
    setSalvando(false);
    if (e) return Alert.alert("Não foi possível salvar", e);
    setLista((l) => l.map((x) => (x.id === s.id ? { ...x, status: situacao, resposta: resposta.trim() || null, feita: x.feita || situacao === "feita" } : x)));
    setAberta(null);
  }

  const abertas = (s: SugestaoRecebida) => s.status !== "feita" && s.status !== "recusada";
  const visiveis = lista.filter((s) => (filtro === "todas" ? true : filtro === "abertas" ? abertas(s) : s.status === filtro));
  const contar = (f: Filtro) => lista.filter((s) => (f === "todas" ? true : f === "abertas" ? abertas(s) : s.status === f)).length;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {(["abertas", ...SITUACOES.map((s) => s.id), "todas"] as Filtro[]).map((f) => (
          <Chip
            key={f}
            rotulo={`${f === "abertas" ? "📥 Em aberto" : f === "todas" ? "Todas" : rotuloSituacao(f)} (${contar(f)})`}
            ativo={filtro === f}
            onPress={() => setFiltro(f)}
          />
        ))}
      </View>

      {carregando && <ActivityIndicator color={colors.accent} />}
      {!!erro && <Text style={[typography.body, { color: colors.danger }]}>{erro}</Text>}
      {!carregando && !erro && visiveis.length === 0 && <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>Nenhuma sugestão aqui.</Text>}

      {visiveis.map((s) => (
        <Cartao key={s.id} style={{ gap: spacing.xs }}>
          <TouchableOpacity onPress={() => abrir(s)} activeOpacity={0.8} style={{ gap: spacing.xs }}>
            <Text style={typography.label}>
              {rotuloSituacao(s.status)} · {rotuloDia(dataISO(new Date(s.created_at)))}
            </Text>
            <Text style={typography.body}>{s.texto}</Text>
            <Text style={typography.label}>
              👤 {s.autor_nome ?? "?"}
              {s.autor_email ? ` · ${s.autor_email}` : ""} · 🏠 {s.casa_nome ?? "?"}
            </Text>
            <Text style={typography.label}>
              📱 {s.dispositivo ?? "?"} · versão {s.versao_app ?? "?"}
            </Text>
            {!!s.resposta && aberta !== s.id && <Text style={[typography.body, { fontSize: 14, color: colors.accent }]}>💬 {s.resposta}</Text>}
          </TouchableOpacity>
          {aberta === s.id && (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Text style={typography.label}>SITUAÇÃO</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {SITUACOES.map((x) => (
                  <Chip key={x.id} rotulo={x.rotulo} ativo={situacao === x.id} onPress={() => setSituacao(x.id)} />
                ))}
              </View>
              <Text style={typography.label}>RESPOSTA (A PESSOA VÊ NO APP)</Text>
              <TextInput
                value={resposta}
                onChangeText={setResposta}
                placeholder="Ex.: Obrigado! Já está no app, é só fechar e abrir."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={2000}
                style={[estiloInput(), { minHeight: 80, textAlignVertical: "top" }]}
              />
              <Botao titulo="Salvar" onPress={() => salvar(s)} carregando={salvando} />
            </View>
          )}
        </Cartao>
      ))}

      {!carregando && <Botao titulo="🔄 Atualizar" variante="secundario" onPress={carregar} />}
    </ScrollView>
  );
}
