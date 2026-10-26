import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Chip, estiloInput, TelaFormulario } from "../components/ui";
import { useCategorias } from "../data/hooks";
import { CORES_CATEGORIA, emojiCategoria, EMOJIS_CATEGORIA } from "../data/tipos";
import { centavosDoTexto, formatarReais } from "../lib/format";
import { linhas, obter } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CategoriaForm">;

// Criar/editar categoria. Excluir = arquivar (some das listas); se tiver despesas, elas vão
// para outra categoria escolhida, para nada ficar "sem categoria".
export function CategoriaFormScreen({ navigation, route }: Props) {
  const categoriaId = route.params?.categoriaId;
  const { casa } = useCasa();
  const { categorias } = useCategorias();
  const existente = categoriaId ? obter("categorias", categoriaId) : undefined;

  const [nome, setNome] = useState<string>(existente?.nome ?? "");
  const [icone, setIcone] = useState<string>(existente?.icone ?? "📦");
  const [cor, setCor] = useState<string>(existente?.cor ?? CORES_CATEGORIA[0]);
  const [limite, setLimite] = useState(existente?.limite ? Math.round(Number(existente.limite) * 100) : 0);
  const [excluindo, setExcluindo] = useState(false);
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: categoriaId ? "Editar categoria" : "Nova categoria" });
  }, [navigation, categoriaId]);

  const emojiAtual = emojiCategoria(icone);
  const usos = categoriaId && casa
    ? {
        despesas: linhas("gastos").filter((g) => g.casa_id === casa.id && g.categoria_id === categoriaId).length,
        contas: linhas("contas_fixas").filter((c) => c.casa_id === casa.id && c.categoria_id === categoriaId && c.ativa !== false).length,
      }
    : { despesas: 0, contas: 0 };

  function salvar() {
    if (!casa) return;
    const n = nome.trim();
    if (!n) return Alert.alert("Nome", "Dê um nome à categoria (ex.: Academia, Farmácia).");
    if (categorias.some((c) => c.id !== categoriaId && c.nome.trim().toLowerCase() === n.toLowerCase())) {
      return Alert.alert("Nome repetido", `Já existe a categoria "${n}".`);
    }
    const dados = { nome: n.slice(0, 40), icone, cor, limite: limite ? limite / 100 : null };
    if (existente) atualizar("categorias", existente.id, dados);
    else {
      // Nova entra antes de "Outros" (ordem 99).
      const ordem = Math.min(98, Math.max(0, ...categorias.filter((c) => (c.ordem ?? 0) < 99).map((c) => c.ordem ?? 0)) + 1);
      inserir("categorias", { ...dados, casa_id: casa.id, ordem, arquivada: false });
    }
    navigation.goBack();
  }

  function confirmarExclusao() {
    if (!existente || !casa) return;
    const total = usos.despesas + usos.contas;
    if (total > 0 && !destino) return Alert.alert("Para onde mover?", "Escolha a categoria que vai receber as despesas desta.");
    const nomeDestino = categorias.find((c) => c.id === destino)?.nome;
    Alert.alert(
      `Excluir "${existente.nome}"?`,
      total > 0 ? `${usos.despesas} despesas e ${usos.contas} contas fixas vão para "${nomeDestino}".` : "Ela some das listas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            if (destino) {
              for (const g of linhas("gastos").filter((x) => x.casa_id === casa.id && x.categoria_id === existente.id)) atualizar("gastos", g.id, { categoria_id: destino });
              for (const c of linhas("contas_fixas").filter((x) => x.casa_id === casa.id && x.categoria_id === existente.id)) atualizar("contas_fixas", c.id, { categoria_id: destino });
            }
            atualizar("categorias", existente.id, { arquivada: true });
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <TelaFormulario>
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: cor, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 36 }}>{emojiAtual}</Text>
        </View>
      </View>

      <Campo rotulo="NOME" value={nome} onChangeText={setNome} placeholder="Ex.: Academia, Farmácia, Doces" autoCapitalize="sentences" maxLength={40} />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>ÍCONE</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EMOJIS_CATEGORIA.map((e) => (
          <TouchableOpacity
            key={e}
            // Categoria padrão continua com o nome do ícone se o emoji for o mesmo (a importação usa esse nome).
            onPress={() => setIcone(existente && emojiCategoria(existente.icone) === e ? existente.icone : e)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: emojiAtual === e ? colors.accent : "transparent",
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>COR</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {CORES_CATEGORIA.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCor(c)}
            accessibilityLabel={`Cor ${c}`}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: 3, borderColor: cor === c ? colors.textPrimary : "transparent" }}
          />
        ))}
      </View>

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>🎯 LIMITE POR MÊS (OPCIONAL)</Text>
      <TextInput
        value={limite ? formatarReais(limite / 100) : ""}
        onChangeText={(t) => setLimite(centavosDoTexto(t))}
        placeholder="Sem limite"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        style={estiloInput()}
      />

      <Botao titulo="Salvar" onPress={salvar} style={{ marginTop: spacing.xl }} />

      {existente && !excluindo && <Botao titulo="Excluir categoria" variante="link" onPress={() => setExcluindo(true)} style={{ marginTop: spacing.sm }} />}
      {existente && excluindo && (
        <View style={{ marginTop: spacing.lg }}>
          {usos.despesas + usos.contas > 0 ? (
            <>
              <Text style={[typography.body, { marginBottom: spacing.sm }]}>
                {usos.despesas} {usos.despesas === 1 ? "despesa usa" : "despesas usam"} esta categoria
                {usos.contas ? ` (e ${usos.contas} ${usos.contas === 1 ? "conta fixa" : "contas fixas"})` : ""}. Para qual categoria elas vão?
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {categorias
                  .filter((c) => c.id !== existente.id)
                  .map((c) => (
                    <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={destino === c.id} onPress={() => setDestino(c.id)} />
                  ))}
              </View>
            </>
          ) : (
            <Text style={typography.body}>Nenhuma despesa usa esta categoria.</Text>
          )}
          <Botao titulo="Confirmar exclusão" variante="secundario" onPress={confirmarExclusao} style={{ marginTop: spacing.md }} />
          <Botao titulo="Cancelar" variante="link" onPress={() => setExcluindo(false)} />
        </View>
      )}
    </TelaFormulario>
  );
}
