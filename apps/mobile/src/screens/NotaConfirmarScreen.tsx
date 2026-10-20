import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, Chip } from "../components/ui";
import { useCartoes, useCategorias } from "../data/hooks";
import { emojiCategoria, FORMAS_PAGAMENTO, type FormaPagamento } from "../data/tipos";
import { chaveDoQr } from "../fiscal/nfce";
import { formatarReais, hojeISO, rotuloDia } from "../lib/format";
import { supabase, traduzirErro } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "NotaConfirmar">;

// Nota lida: a pessoa confere, escolhe categoria e como pagou, e salva.
// Grava a nota + itens e cria o gasto com o total, ligado à nota.
// Itens podem ser tirados (ex.: algo comprado para outra finalidade, como os doces):
// a despesa fica só com o que sobrou.
export function NotaConfirmarScreen({ navigation, route }: Props) {
  const { qr, nota } = route.params;
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [cartaoId, setCartaoId] = useState<string | null>(null);
  const [pagoPor, setPagoPor] = useState<string | null>(userId);
  const [salvando, setSalvando] = useState(false);
  /** Índices dos itens tirados da despesa. */
  const [removidos, setRemovidos] = useState<Set<number>>(new Set());

  const itensMantidos = nota.itens.filter((_, i) => !removidos.has(i));
  const valorRemovido = nota.itens.reduce((s, item, i) => (removidos.has(i) ? s + item.valorTotal : s), 0);
  // Total da nota já vem com descontos; tira só o valor dos itens removidos.
  const totalDespesa = Math.max(0, Math.round((nota.total - valorRemovido) * 100) / 100);

  function alternarItem(i: number) {
    setRemovidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });
  }

  // Nota fiscal quase sempre é mercado: já deixa marcado.
  useEffect(() => {
    if (!categoriaId && categorias.length) setCategoriaId((categorias.find((c) => c.icone === "cart") ?? categorias[0]).id);
  }, [categorias, categoriaId]);

  useEffect(() => {
    if (forma === "credito" && !cartaoId && cartoes.length === 1) setCartaoId(cartoes[0].id);
  }, [forma, cartoes, cartaoId]);

  const data = nota.dataCompra ? nota.dataCompra.slice(0, 10) : hojeISO();

  async function salvar() {
    if (!casa) return;
    const chave = chaveDoQr(qr);
    if (!chave) return Alert.alert("Erro", "Chave da nota não encontrada no QR Code.");
    if (itensMantidos.length === 0 || totalDespesa <= 0) return Alert.alert("Nenhum item", "Deixe pelo menos um item na despesa.");
    if (forma === "credito" && !cartaoId) {
      return Alert.alert("Cartão", cartoes.length ? "Escolha qual cartão foi usado." : "Cadastre um cartão primeiro (tela inicial → Cartões).");
    }

    setSalvando(true);
    try {
      const { data: notaRow, error: erroNota } = await supabase
        .from("notas")
        .insert({
          casa_id: casa.id,
          chave_acesso: chave,
          estabelecimento: nota.estabelecimento,
          cnpj: nota.cnpj || null,
          endereco: nota.endereco || null,
          total: nota.total,
          // A página da SEFAZ mostra horário de Brasília (sem fuso no texto).
          data_compra: nota.dataCompra ? `${nota.dataCompra}-03:00` : null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (erroNota) {
        if (erroNota.code === "23505") {
          Alert.alert("Nota já lançada", "Essa nota fiscal já foi registrada antes.", [{ text: "OK", onPress: () => navigation.popToTop() }]);
        } else {
          Alert.alert("Não foi possível salvar", traduzirErro(erroNota.message));
        }
        return;
      }

      const desfazer = () => supabase.from("notas").delete().eq("id", notaRow.id);

      const { error: erroItens } = await supabase.from("nota_itens").insert(
        itensMantidos.map((i) => ({
          nota_id: notaRow.id,
          casa_id: casa.id,
          nome: i.nome,
          quantidade: i.quantidade,
          valor_unitario: i.valorUnitario,
          valor_total: i.valorTotal,
        })),
      );
      if (erroItens) {
        await desfazer();
        return Alert.alert("Não foi possível salvar", traduzirErro(erroItens.message));
      }

      const { error: erroGasto } = await supabase.from("gastos").insert({
        casa_id: casa.id,
        valor: totalDespesa,
        data,
        descricao: nota.estabelecimento,
        categoria_id: categoriaId,
        forma_pagamento: forma,
        cartao_id: forma === "credito" ? cartaoId : null,
        pago_por: pagoPor,
        nota_id: notaRow.id,
      });
      if (erroGasto) {
        await desfazer();
        return Alert.alert("Não foi possível salvar", traduzirErro(erroGasto.message));
      }

      navigation.popToTop();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 }}>
      <Cartao>
        <Text style={[typography.body, { fontWeight: "700" }]}>{nota.estabelecimento}</Text>
        <Text style={typography.label}>{rotuloDia(data)}{nota.endereco ? ` · ${nota.endereco}` : ""}</Text>
        <Text style={{ fontSize: 32, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.sm }}>{formatarReais(totalDespesa)}</Text>
        <Text style={typography.label}>
          {itensMantidos.length} {itensMantidos.length === 1 ? "item" : "itens"}
          {removidos.size > 0 ? ` · ${removidos.size} tirado${removidos.size > 1 ? "s" : ""} (${formatarReais(valorRemovido)}) · nota completa ${formatarReais(nota.total)}` : ""}
        </Text>
      </Cartao>

      <Secao titulo="CATEGORIA">
        {categorias.map((c) => (
          <Chip key={c.id} rotulo={`${emojiCategoria(c.icone)} ${c.nome}`} cor={c.cor} ativo={categoriaId === c.id} onPress={() => setCategoriaId(c.id)} />
        ))}
      </Secao>

      <Secao titulo="COMO PAGOU">
        {FORMAS_PAGAMENTO.map((f) => (
          <Chip key={f.valor} rotulo={f.rotulo} ativo={forma === f.valor} onPress={() => setForma(f.valor)} />
        ))}
      </Secao>

      {forma === "credito" && (
        <Secao titulo="CARTÃO">
          {cartoes.length === 0 ? (
            <Botao titulo="+ Cadastrar cartão" variante="secundario" onPress={() => navigation.navigate("CartaoForm", {})} />
          ) : (
            cartoes.map((c) => <Chip key={c.id} rotulo={`💳 ${c.nome}`} ativo={cartaoId === c.id} onPress={() => setCartaoId(c.id)} />)
          )}
        </Secao>
      )}

      {membros.length > 1 && (
        <Secao titulo="QUEM PAGOU">
          {membros.map((m) => (
            <Chip key={m.user_id} rotulo={m.user_id === userId ? `${m.nome} (eu)` : m.nome} ativo={pagoPor === m.user_id} onPress={() => setPagoPor(m.user_id)} />
          ))}
        </Secao>
      )}

      <ItensDaNota itens={nota.itens} removidos={removidos} onAlternar={alternarItem} />

      <Botao titulo={`Salvar despesa · ${formatarReais(totalDespesa)}`} onPress={salvar} carregando={salvando} />
    </ScrollView>
  );
}

/** Lista de itens da nota. Com `onAlternar`, cada item ganha um botão para tirar/voltar da despesa. */
export function ItensDaNota({
  itens,
  removidos,
  onAlternar,
}: {
  itens: { nome: string; quantidade: number; valorTotal: number }[];
  removidos?: Set<number>;
  onAlternar?: (indice: number) => void;
}) {
  return (
    <Cartao style={{ paddingVertical: spacing.xs }}>
      <Text style={[typography.label, { paddingVertical: spacing.sm }]}>
        ITENS DA NOTA{onAlternar ? " · toque no ✕ para tirar da despesa" : ""}
      </Text>
      {itens.map((i, idx) => {
        const tirado = removidos?.has(idx) ?? false;
        return (
          <View key={idx} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border, opacity: tirado ? 0.45 : 1 }}>
            <Text style={[typography.body, { flex: 1, fontSize: 14, textDecorationLine: tirado ? "line-through" : "none" }]} numberOfLines={2}>
              {i.quantidade !== 1 ? `${String(i.quantidade).replace(".", ",")} × ` : ""}
              {i.nome}
            </Text>
            <Text style={[typography.body, { fontSize: 14, marginLeft: spacing.sm, textDecorationLine: tirado ? "line-through" : "none" }]}>{formatarReais(i.valorTotal)}</Text>
            {onAlternar && (
              <TouchableOpacity
                onPress={() => onAlternar(idx)}
                accessibilityLabel={tirado ? "Voltar item para a despesa" : "Tirar item da despesa"}
                style={{ marginLeft: spacing.sm, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: tirado ? colors.accent : colors.danger }}
              >
                <Text style={{ color: tirado ? colors.accent : colors.danger, fontWeight: "700" }}>{tirado ? "↺" : "✕"}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </Cartao>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[typography.label, { marginBottom: spacing.sm }]}>{titulo}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>
    </View>
  );
}
