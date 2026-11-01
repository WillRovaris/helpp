import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, Chip, estiloInput, TelaFormulario } from "../components/ui";
import { useCartoes } from "../data/hooks";
import { type ContaFixa, FORMAS_PAGAMENTO, type FormaPagamento, type Gasto } from "../data/tipos";
import { vencimentoNoMes } from "../lib/contas";
import { diaMes } from "../lib/fatura";
import { centavosDoTexto, formatarReais, hojeISO, isoDeTextoBR, MESES, mascaraData, somarDias } from "../lib/format";
import { linhas, obter } from "../offline/banco";
import { atualizar, excluir, inserir } from "../offline/repo";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "PagarConta">;

// "Paguei": registra o pagamento da conta no mês E lança o gasto (para entrar
// no total do mês e nas categorias). Editar corrige os dois; desfazer apaga os dois.
export function PagarContaScreen({ navigation, route }: Props) {
  const { contaId, competencia } = route.params;
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { cartoes } = useCartoes();

  const [conta, setConta] = useState<ContaFixa | null>(null);
  const [pagamento, setPagamento] = useState<{ id: string; valor: number; pago_em: string; gasto_id: string | null } | null>(null);
  const [centavos, setCentavos] = useState(0);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [cartaoId, setCartaoId] = useState<string | null>(null);
  const [pagoPor, setPagoPor] = useState<string | null>(userId);
  const [data, setData] = useState(hojeISO());
  const [outraData, setOutraData] = useState("");
  const [salvando, setSalvando] = useState(false);
  /** Despesa lançada pelo pagamento (pode ter sido excluída no Histórico). */
  const [gastoPago, setGastoPago] = useState<Gasto | null>(null);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    // lido da cópia do celular (funciona sem internet)
    const c = obter("contas_fixas", contaId);
    if (c) {
      const contaLida = { ...c, valor: c.valor == null ? null : Number(c.valor) } as ContaFixa;
      setConta(contaLida);
      setCentavos(contaLida.valor ? Math.round(contaLida.valor * 100) : 0);
      if (c.pago_por) setPagoPor(c.pago_por);
      if (c.forma_pagamento) setForma(c.forma_pagamento);
      if (c.cartao_id) setCartaoId(c.cartao_id);
      navigation.setOptions({ title: c.nome });
    }
    const p = linhas("contas_pagamentos").find((x) => x.conta_id === contaId && x.competencia === competencia);
    if (p) {
      setPagamento({ id: p.id, valor: Number(p.valor), pago_em: p.pago_em, gasto_id: p.gasto_id });
      const g = p.gasto_id ? obter("gastos", p.gasto_id) : undefined;
      if (g) setGastoPago(g as Gasto);
    }
  }, [contaId, competencia, navigation]);

  // Um cartão só: já vem marcado (também se o cartão da conta foi excluído).
  useEffect(() => {
    if (!editando && forma === "credito" && cartoes.length === 1 && !cartoes.some((c) => c.id === cartaoId)) setCartaoId(cartoes[0].id);
  }, [forma, cartoes, cartaoId, editando]);

  if (!conta) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const mes = Number(competencia.slice(5, 7)) - 1;
  const vencimento = vencimentoNoMes(competencia, conta.dia_vencimento);

  async function confirmar() {
    if (!casa || !conta) return;
    if (centavos <= 0) return Alert.alert("Valor", "Informe quanto foi pago.");
    let dataFinal = data;
    if (outraData) {
      const iso = isoDeTextoBR(outraData);
      if (!iso) return Alert.alert("Data", "Complete a data: dia/mês/ano.");
      dataFinal = iso;
    }
    // Ao editar, vale manter o cartão do pagamento mesmo que ele já tenha sido excluído.
    const cartaoOk = cartoes.some((c) => c.id === cartaoId) || (editando && !!cartaoId && cartaoId === gastoPago?.cartao_id);
    if (forma === "credito" && !cartaoOk && !(editando && !gastoPago)) return Alert.alert("Cartão", "Escolha qual cartão foi usado.");

    if (editando && pagamento) {
      atualizar("contas_pagamentos", pagamento.id, { valor: centavos / 100, pago_em: dataFinal });
      if (gastoPago) {
        atualizar("gastos", gastoPago.id, {
          valor: centavos / 100,
          data: dataFinal,
          forma_pagamento: forma,
          cartao_id: forma === "credito" ? cartaoId : null,
          pago_por: pagoPor,
          data_pagamento: forma === "credito" ? dataFinal : null,
        });
      }
      navigation.goBack();
      return;
    }

    if (linhas("contas_pagamentos").some((x) => x.conta_id === conta.id && x.competencia === competencia)) {
      return Alert.alert("Já paga", "Essa conta já está paga neste mês.");
    }
    setSalvando(true);
    try {
      // Despesa + registro de pagamento: gravados no celular e enviados na sincronização.
      const gasto = inserir("gastos", {
        casa_id: casa.id,
        valor: centavos / 100,
        data: dataFinal,
        descricao: conta.nome,
        categoria_id: conta.categoria_id,
        forma_pagamento: forma,
        cartao_id: forma === "credito" ? cartaoId : null,
        pago_por: pagoPor,
        // No cartão, a data escolhida é quando o dinheiro sai (define o mês e a fatura).
        ...(forma === "credito" ? { data_pagamento: dataFinal } : {}),
      });
      inserir("contas_pagamentos", {
        conta_id: conta.id,
        casa_id: casa.id,
        competencia,
        valor: centavos / 100,
        pago_em: dataFinal,
        gasto_id: gasto.id,
      });
      navigation.goBack();
    } finally {
      setSalvando(false);
    }
  }

  function desfazer() {
    Alert.alert("Desfazer pagamento?", "A conta volta a ficar em aberto e a despesa lançada é excluída.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desfazer",
        style: "destructive",
        onPress: () => {
          excluir("contas_pagamentos", [pagamento!.id]);
          if (pagamento!.gasto_id) excluir("gastos", [pagamento!.gasto_id]);
          navigation.goBack();
        },
      },
    ]);
  }

  const ontem = somarDias(hojeISO(), -1);

  /** Abre o formulário com o que foi gravado no pagamento. */
  function editarPagamento() {
    if (!pagamento) return;
    const dia = pagamento.pago_em.slice(0, 10);
    setCentavos(Math.round(pagamento.valor * 100));
    setData(dia);
    setOutraData(dia === hojeISO() || dia === ontem ? "" : dia.split("-").reverse().join("/"));
    if (gastoPago) {
      setForma(gastoPago.forma_pagamento);
      setCartaoId(gastoPago.cartao_id ?? null);
      setPagoPor(gastoPago.pago_por ?? null);
    }
    setEditando(true);
  }

  if (pagamento && !editando) {
    const rotuloForma = gastoPago ? FORMAS_PAGAMENTO.find((f) => f.valor === gastoPago.forma_pagamento)?.rotulo : undefined;
    const cartaoPago = gastoPago?.cartao_id ? cartoes.find((c) => c.id === gastoPago.cartao_id)?.nome : undefined;
    return (
      <TelaFormulario>
        <Cartao>
          <Text style={typography.label}>PAGA · {MESES[mes].toUpperCase()}</Text>
          <Text style={{ fontSize: 30, fontWeight: "700", color: colors.accent }}>{formatarReais(pagamento.valor)}</Text>
          <Text style={typography.label}>Paga em {diaMes(pagamento.pago_em)} · vencia {diaMes(vencimento)}</Text>
          {!!rotuloForma && <Text style={typography.label}>{cartaoPago ? `💳 ${cartaoPago}` : rotuloForma}</Text>}
        </Cartao>
        <Botao titulo="✏️ Editar pagamento" variante="secundario" onPress={editarPagamento} style={{ marginTop: spacing.md }} />
        <Botao titulo="Desfazer pagamento" variante="link" onPress={desfazer} style={{ marginTop: spacing.sm }} />
      </TelaFormulario>
    );
  }

  // Pagamento sem despesa (excluída no Histórico): só dá para corrigir valor e data.
  const semDespesa = editando && !gastoPago;

  return (
    <TelaFormulario>
      <Text style={typography.label}>
        {MESES[mes].toUpperCase()} · VENCE {diaMes(vencimento)}
      </Text>
      <Text style={[typography.label, { marginTop: spacing.md }]}>VALOR PAGO</Text>
      <TextInput
        value={formatarReais(centavos / 100)}
        onChangeText={(t) => setCentavos(centavosDoTexto(t))}
        keyboardType="number-pad"
        autoFocus={conta.valor == null}
        style={{ fontSize: 36, fontWeight: "700", color: colors.textPrimary, paddingVertical: spacing.sm }}
      />

      {!semDespesa && (
        <Secao titulo="COMO PAGOU">
          {FORMAS_PAGAMENTO.map((f) => (
            <Chip key={f.valor} rotulo={f.rotulo} ativo={forma === f.valor} onPress={() => setForma(f.valor)} />
          ))}
        </Secao>
      )}
      {!semDespesa && forma === "credito" && (
        <Secao titulo="CARTÃO">
          {cartoes.map((c) => (
            <Chip key={c.id} rotulo={`💳 ${c.nome}`} ativo={cartaoId === c.id} onPress={() => setCartaoId(c.id)} />
          ))}
          <Chip rotulo="+ Novo cartão" ativo={false} onPress={() => navigation.navigate("CartaoForm", {})} />
        </Secao>
      )}

      {!semDespesa && membros.length > 1 && (
        <Secao titulo="QUEM PAGOU">
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.user_id === userId ? `${m.nome} (eu)` : m.nome} ativo={pagoPor === m.user_id} onPress={() => setPagoPor(m.user_id)} />
          ))}
        </Secao>
      )}

      <Secao titulo="QUANDO PAGOU">
        <Chip rotulo="Hoje" ativo={data === hojeISO() && !outraData} onPress={() => { setData(hojeISO()); setOutraData(""); }} />
        <Chip rotulo="Ontem" ativo={data === ontem && !outraData} onPress={() => { setData(ontem); setOutraData(""); }} />
        <TextInput
          value={outraData}
          onChangeText={(t) => {
            const m = mascaraData(t);
            setOutraData(m);
            const iso = isoDeTextoBR(m);
            if (iso) setData(iso);
          }}
          placeholder="dd/mm/aaaa"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={10}
          style={[estiloInput(), { borderRadius: 999, paddingVertical: 6, minWidth: 130, fontSize: 14 }]}
        />
      </Secao>

      <Botao titulo={editando ? "Salvar alteração" : "Confirmar pagamento"} onPress={confirmar} carregando={salvando} style={{ marginTop: spacing.xl }} />
      {editando && <Botao titulo="Cancelar" variante="link" onPress={() => setEditando(false)} style={{ marginTop: spacing.sm }} />}
    </TelaFormulario>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>{titulo}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>{children}</View>
    </View>
  );
}
