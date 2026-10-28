import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { SeletorMes } from "../components/SeletorMes";
import { Botao, Campo, Chip, estiloInput, TelaFormulario } from "../components/ui";
import { useCategorias } from "../data/hooks";
import { emojiCategoria } from "../data/tipos";
import { competencia } from "../lib/contas";
import { somarMeses } from "../lib/fatura";
import { centavosDoTexto, formatarReais, MESES } from "../lib/format";
import { obter } from "../offline/banco";
import { atualizar, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ContaForm">;

const OPCOES_MESES = [3, 6, 12, 24];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Diferença em meses entre duas competências. */
function mesesEntre(de: string, ate: string): number {
  return (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7)));
}

function CaixaMes({ rotulo, texto, onPress }: { rotulo: string; texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm }}
    >
      <Text style={typography.label}>{rotulo}</Text>
      <Text style={[typography.body, { fontWeight: "700", marginTop: 2 }]}>{texto} ▾</Text>
    </TouchableOpacity>
  );
}

function nomeMes(comp: string, curto = false): string {
  const m = Number(comp.slice(5, 7)) - 1;
  return curto ? `${MESES_CURTOS[m]}/${comp.slice(2, 4)}` : `${MESES[m]}/${comp.slice(0, 4)}`;
}

export function ContaFormScreen({ navigation, route }: Props) {
  const contaId = route.params?.contaId;
  // Conta nova pode vir preenchida (ex.: assinatura detectada, nova dívida).
  const pre = route.params?.preencher;
  const { casa, membros } = useCasa();
  const { userId } = useAuth();
  const { categorias } = useCategorias();
  /** Quem da casa paga esta conta (vem marcado no "Paguei" e conta no fechamento do mês). */
  const [pagoPor, setPagoPor] = useState<string | null>(contaId ? null : userId);
  const hoje = new Date();
  const [nome, setNome] = useState(pre?.nome ?? "");
  const [varia, setVaria] = useState(false);
  const [centavos, setCentavos] = useState(pre?.valor ? Math.round(pre.valor * 100) : 0);
  const [dia, setDia] = useState(pre?.dia ? String(pre.dia) : "");
  const [categoriaId, setCategoriaId] = useState<string | null>(pre?.categoriaId ?? null);
  /** Primeiro mês da conta (YYYY-MM-01). null = conta antiga sem início definido (vale desde sempre). */
  const [inicio, setInicio] = useState<string | null>(contaId ? null : competencia(hoje.getFullYear(), hoje.getMonth()));
  /** null = sem prazo. */
  const [meses, setMeses] = useState<number | null>(pre?.meses ?? null);
  const [mesesOutro, setMesesOutro] = useState("");
  const [periodoCarregado, setPeriodoCarregado] = useState(false);
  const [inicioAlterado, setInicioAlterado] = useState(false);
  const [escolhendo, setEscolhendo] = useState<"inicio" | "fim" | null>(null);

  /** Define a duração; números fora dos botões aparecem no campo "outro". */
  function aplicarMeses(n: number) {
    setMeses(n);
    setMesesOutro(OPCOES_MESES.includes(n) ? "" : String(n));
  }
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: contaId ? "Editar conta" : "Nova conta fixa" });
    if (!contaId) return;
    {
      const data = obter("contas_fixas", contaId);
      {
        if (!data) return;
        setNome(data.nome);
        setVaria(data.valor == null);
        setCentavos(data.valor == null ? 0 : Math.round(Number(data.valor) * 100));
        setDia(String(data.dia_vencimento));
        setCategoriaId(data.categoria_id);
        setPagoPor(data.pago_por ?? null);
        if (data.inicio || data.meses) setPeriodoCarregado(true);
        setInicio(data.inicio ?? null);
        setMeses(data.meses ?? null);
        if (data.meses && !OPCOES_MESES.includes(data.meses)) setMesesOutro(String(data.meses));
      }
    }
  }, [contaId, navigation]);

  // Conta nova: categoria "Contas" já marcada.
  useEffect(() => {
    if (!contaId && !categoriaId && categorias.length) setCategoriaId(categorias.find((c) => c.icone === "receipt")?.id ?? null);
  }, [categorias, categoriaId, contaId]);

  const inicioEfetivo = inicio ?? competencia(hoje.getFullYear(), hoje.getMonth());
  const ultimoMes = meses ? somarMeses(inicioEfetivo, meses - 1) : null;

  async function salvar() {
    if (!casa) return;
    const d = parseInt(dia, 10);
    if (!nome.trim()) return Alert.alert("Nome", "Dê um nome à conta (ex.: Luz, Aluguel, Plano de saúde).");
    if (!(d >= 1 && d <= 31)) return Alert.alert("Vencimento", "Informe o dia do vencimento (1 a 31).");
    if (!varia && centavos <= 0) return Alert.alert("Valor", "Informe o valor, ou marque que o valor muda todo mês.");
    if (mesesOutro && !(meses && meses >= 1)) return Alert.alert("Meses", "Informe por quantos meses (1 a 120).");

    // Período só é gravado quando usado (assim a tela funciona mesmo antes do SQL 09).
    const usaPeriodo = meses != null || periodoCarregado || inicioAlterado;
    const registro = {
      casa_id: casa.id,
      nome: nome.trim(),
      valor: varia ? null : centavos / 100,
      dia_vencimento: d,
      categoria_id: categoriaId,
      pago_por: pagoPor ?? (membros.length <= 1 ? userId : null),
      ...(usaPeriodo ? { inicio: meses != null ? inicioEfetivo : inicio, meses } : {}),
    };
    if (contaId) atualizar("contas_fixas", contaId, registro);
    else inserir("contas_fixas", { ...registro, ativa: true });
    navigation.goBack();
  }

  function remover() {
    Alert.alert("Remover conta?", "Ela some da lista dos próximos meses. Os pagamentos já feitos continuam no histórico.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          atualizar("contas_fixas", contaId!, { ativa: false });
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <TelaFormulario>
      <Campo rotulo="NOME DA CONTA" value={nome} onChangeText={setNome} placeholder="Ex.: Luz, Aluguel, Plano de saúde, Escola" autoCapitalize="sentences" />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>VALOR</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <Chip rotulo="Valor fixo" ativo={!varia} onPress={() => setVaria(false)} />
        <Chip rotulo="Muda todo mês" ativo={varia} onPress={() => setVaria(true)} />
      </View>
      {!varia && <Campo rotulo="VALOR MENSAL" value={formatarReais(centavos / 100)} onChangeText={(t) => setCentavos(centavosDoTexto(t))} keyboardType="number-pad" />}
      {varia && <Text style={[typography.label, { marginBottom: spacing.md }]}>Você informa o valor na hora de marcar como paga.</Text>}

      <Campo rotulo="DIA DO VENCIMENTO" value={dia} onChangeText={(t) => setDia(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={2} placeholder="Ex.: 10" />

      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        <CaixaMes rotulo="📅 COMEÇA EM" texto={inicio ? nomeMes(inicio) : "Desde o cadastro"} onPress={() => setEscolhendo("inicio")} />
        <CaixaMes rotulo="🏁 TERMINA EM" texto={ultimoMes ? nomeMes(ultimoMes) : "Sem prazo"} onPress={() => setEscolhendo("fim")} />
      </View>
      <SeletorMes
        visivel={escolhendo === "inicio"}
        titulo="Começa em"
        valor={inicio}
        onFechar={() => setEscolhendo(null)}
        onEscolher={(comp) => {
          // Se já tinha fim escolhido, mantém o fim e recalcula quantos meses.
          if (ultimoMes) {
            const n = mesesEntre(comp, ultimoMes) + 1;
            if (n >= 1) aplicarMeses(n);
          }
          setInicio(comp);
          setInicioAlterado(true);
          setEscolhendo(null);
        }}
      />
      <SeletorMes
        visivel={escolhendo === "fim"}
        titulo="Termina em (último mês que paga)"
        valor={ultimoMes}
        minimo={inicioEfetivo}
        onFechar={() => setEscolhendo(null)}
        onEscolher={(comp) => {
          aplicarMeses(mesesEntre(inicioEfetivo, comp) + 1);
          setEscolhendo(null);
        }}
        rotuloLimpar="Sem prazo"
        onLimpar={() => {
          setMeses(null);
          setMesesOutro("");
          setEscolhendo(null);
        }}
      />

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>OU ESCOLHA QUANTOS MESES FALTAM PAGAR</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
        <Chip rotulo="Sem prazo" ativo={meses == null} onPress={() => { setMeses(null); setMesesOutro(""); }} />
        {OPCOES_MESES.map((n) => (
          <Chip key={n} rotulo={`${n} meses`} ativo={meses === n && !mesesOutro} onPress={() => { setMeses(n); setMesesOutro(""); }} />
        ))}
        <TextInput
          value={mesesOutro}
          onChangeText={(t) => {
            const n = t.replace(/\D/g, "").slice(0, 3);
            setMesesOutro(n);
            const v = parseInt(n, 10);
            setMeses(v >= 1 && v <= 120 ? v : n ? meses : null);
          }}
          placeholder="outro"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          style={[estiloInput(), { borderRadius: 999, paddingVertical: 6, width: 80, textAlign: "center", fontSize: 14, borderColor: mesesOutro ? colors.accent : colors.border }]}
        />
      </View>

      {meses != null && ultimoMes && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[typography.label, { color: colors.accent, marginBottom: 4 }]}>
            {meses}x {varia ? "" : `de ${formatarReais(centavos / 100)} `}— de {nomeMes(inicioEfetivo)} até {nomeMes(ultimoMes)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {Array.from({ length: Math.min(meses, 24) }, (_, i) => somarMeses(inicioEfetivo, i)).map((comp, i) => (
              <Text key={comp} style={[typography.label, { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
                {i + 1}ª {nomeMes(comp, true)}
                {varia ? "" : ` · ${formatarReais(centavos / 100)}`}
              </Text>
            ))}
            {meses > 24 && <Text style={typography.label}>… e mais {meses - 24}</Text>}
          </View>
        </View>
      )}

      <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>CATEGORIA</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {categorias.map((c) => (
          <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={categoriaId === c.id} onPress={() => setCategoriaId(c.id)} />
        ))}
      </View>

      {membros.length > 1 && (
        <>
          <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>QUEM PAGA ESTA CONTA</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {membros.map((m) => (
              <Chip key={m.user_id} rotulo={`👤 ${m.user_id === userId ? `${m.nome} (eu)` : m.nome}`} ativo={pagoPor === m.user_id} onPress={() => setPagoPor(m.user_id)} />
            ))}
          </View>
        </>
      )}

      <Botao titulo="Salvar" onPress={salvar} carregando={salvando} style={{ marginTop: spacing.xl }} />
      {contaId && <Botao titulo="Remover conta" variante="link" onPress={remover} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}
