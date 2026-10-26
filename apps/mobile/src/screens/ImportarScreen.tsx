import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, Cartao, Chip, useEspacoRodape } from "../components/ui";
import { useCartoes, useCategorias, useImportacoes } from "../data/hooks";
import { emojiCategoria, type Importacao } from "../data/tipos";
import { type ArquivoLido, ehPDF, lerArquivo, lerLinhasPDF } from "../importacao/leitor";
import { BANCOS, bancoProvavel, haQuanto, reconstruirHistorico, rotuloImportacao, ultimaDeCadaOrigem } from "../importacao/historico";
import { PdfTexto, type ResultadoPdf } from "../importacao/PdfTexto";
import { descricaoSemParcela, type ItemImportacao, preparar, type TipoArquivo } from "../importacao/preparar";
import { competencia, periodoNoMes } from "../lib/contas";
import { diaMes, faturaDaCompra, faturaVizinha, somarMeses } from "../lib/fatura";
import { dataDeISO, dataISO, formatarReais, gerarUuid, MESES } from "../lib/format";
import { linhas as linhasLocais } from "../offline/banco";
import { atualizar, inserir, inserirVarios } from "../offline/repo";
import { BotaoOlho, usePrivacidade } from "../privacidade/PrivacidadeContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Importar">;

/** Escolhas da pessoa por item (por cima da sugestão automática). */
type Ajuste = { incluir?: boolean; categoriaId?: string | null; baixa?: boolean };

interface Contexto {
  jaImportados: Set<string>;
  existentes: { data: string; valor: number; cartao_id: string | null }[];
  contasAbertas: { id: string; nome: string; valor: number | null; dia_vencimento: number; competencia: string; categoria_id: string | null }[];
  parcelasLancadas: { cartao_id: string | null; valor: number; parcela: number; parcelas: number }[];
}

const LIMITE_ARQUIVO = 10 * 1024 * 1024;

function somarDiasISO(iso: string, dias: number): string {
  const d = dataDeISO(iso);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

export function ImportarScreen({ navigation }: Props) {
  const rodape = useEspacoRodape();
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { importacoes } = useImportacoes();
  const { mostrarValor } = usePrivacidade();
  const { categorias } = useCategorias();
  const { cartoes } = useCartoes();

  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [tipo, setTipo] = useState<TipoArquivo>("extrato");
  const [cartaoId, setCartaoId] = useState<string | null>(null);
  const [deslocFatura, setDeslocFatura] = useState(0);
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [abertoCategoria, setAbertoCategoria] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mostrarAjuda, setMostrarAjuda] = useState(false);
  /** PDF em leitura (texto extraído numa WebView escondida). */
  const [pdf, setPdf] = useState<{ base64: string; nome: string; senha: string; pedindoSenha: boolean; tentativa: number } | null>(null);
  const [senhaDigitada, setSenhaDigitada] = useState("");

  const cartao = cartoes.find((c) => c.id === cartaoId);
  /** Banco do extrato (para o histórico: "Extrato Bradesco Will"). */
  const [banco, setBanco] = useState<string | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  // Importações de antes do histórico existir: remonta pelos lançamentos importados (uma vez por grupo; id fixo evita repetir).
  useEffect(() => {
    if (!casa) return;
    const reais = linhasLocais("importacoes").filter((i) => i.casa_id === casa.id);
    const ids = new Set(reais.map((i) => i.id));
    const coberto = (r: { cartao_id: string | null; created_at: string }) =>
      reais.some((i) => (i.cartao_id ?? null) === (r.cartao_id ?? null) && Math.abs(new Date(i.created_at).getTime() - new Date(r.created_at).getTime()) < 3 * 60000);
    const gastosCasa = linhasLocais("gastos").filter((g) => g.casa_id === casa.id).map((g) => ({ ...g, valor: Number(g.valor) }));
    const faltando = reconstruirHistorico(gastosCasa as Parameters<typeof reconstruirHistorico>[0], casa.id).filter((r) => !ids.has(r.id) && !coberto(r));
    if (faltando.length) inserirVarios("importacoes", faltando);
  }, [casa]);

  const nomeDe = (id: string | null) => membros.find((m) => m.user_id === id)?.nome;
  const rotulo = (imp: Importacao) => rotuloImportacao(imp, cartoes.find((c) => c.id === imp.cartao_id)?.nome, nomeDe(imp.created_by));
  const quando = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Renomear uma importação (ex.: "Extrato Bradesco conta salário"); pode valer para as iguais.
  const [renomeando, setRenomeando] = useState<Importacao | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [renomearIguais, setRenomearIguais] = useState(true);
  const iguais = renomeando ? importacoes.filter((i) => rotulo(i).toLowerCase() === rotulo(renomeando).toLowerCase()) : [];

  useEffect(() => {
    navigation.setOptions({ headerRight: () => <BotaoOlho tamanho={24} /> });
  }, [navigation]);

  function abrirRenomear(imp: Importacao) {
    setRenomeando(imp);
    setNovoNome(rotulo(imp));
    setRenomearIguais(true);
  }

  function salvarNome(nome: string | null) {
    if (!renomeando) return;
    const alvo = renomearIguais ? iguais : [renomeando];
    for (const i of alvo) atualizar("importacoes", i.id, { nome: nome?.trim() || null });
    setRenomeando(null);
  }

  // Fatura de destino: por padrão a da compra mais recente do arquivo; ‹ › muda.
  const fatura = useMemo(() => {
    if (tipo !== "fatura" || !cartao || !arquivo?.lancamentos.length) return null;
    const maisRecente = arquivo.lancamentos.reduce((m, l) => (l.data > m ? l.data : m), "0000-00-00");
    const base = faturaDaCompra(maisRecente, cartao.dia_fechamento, cartao.dia_vencimento);
    const alvo = deslocFatura === 0 ? base : faturaVizinha(base.fechamento, deslocFatura, cartao.dia_fechamento, cartao.dia_vencimento);
    const inicio = faturaVizinha(alvo.fechamento, -1, cartao.dia_fechamento, cartao.dia_vencimento).fechamento;
    return { ...alvo, inicio };
  }, [tipo, cartao, arquivo, deslocFatura]);

  function aplicarLido(lido: ArquivoLido, nome: string) {
    if (!lido.lancamentos.length) throw new Error("Nenhum lançamento encontrado no arquivo.");
    setArquivo(lido);
    setNomeArquivo(nome);
    setAjustes({});
    setDeslocFatura(0);
    const ehFatura = lido.pareceFatura;
    setTipo(ehFatura ? "fatura" : "extrato");
    setBanco(bancoProvavel(nome, lido.banco));
    if (ehFatura && !cartaoId && cartoes.length === 1) setCartaoId(cartoes[0].id);
  }

  function avisarErro(e: unknown) {
    Alert.alert(
      "Não consegui ler o arquivo",
      `${e instanceof Error ? e.message : String(e)}\n\nAceita OFX, CSV, Excel (xlsx/xls) e PDF exportados pelo banco. Se não ler, mande o arquivo para ajustarmos.`,
    );
  }

  // PDF: o texto é extraído por <PdfTexto> (pode pedir senha) e chega em aoLerPdf.
  function aoLerPdf(r: ResultadoPdf) {
    if (!pdf) return;
    if (r.ok) {
      try {
        aplicarLido(lerLinhasPDF(r.linhas), pdf.nome);
        setPdf(null);
      } catch (e) {
        setPdf(null);
        avisarErro(e);
      } finally {
        setLendo(false);
      }
      return;
    }
    setLendo(false);
    if (r.precisaSenha) {
      if (pdf.senha) Alert.alert("Senha incorreta", "Confira a senha do PDF e tente de novo.");
      setPdf({ ...pdf, pedindoSenha: true, tentativa: pdf.tentativa + 1 });
    } else {
      setPdf(null);
      avisarErro(new Error(r.erro));
    }
  }

  async function escolherArquivo() {
    const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    // Segurança: extrato/fatura de verdade tem poucos KB; arquivo enorme pode travar o celular.
    if ((r.assets[0].size ?? 0) > LIMITE_ARQUIVO) {
      return Alert.alert("Arquivo grande demais", "O arquivo tem mais de 10 MB. Extratos e faturas costumam ter bem menos: confira se escolheu o arquivo certo.");
    }
    setLendo(true);
    try {
      const file = new File(r.assets[0].uri);
      const bytes = await file.bytes();
      if (ehPDF(bytes)) {
        setPdf({ base64: await file.base64(), nome: r.assets[0].name, senha: "", pedindoSenha: false, tentativa: 0 });
        return; // continua em aoLerPdf
      }
      aplicarLido(lerArquivo(bytes), r.assets[0].name);
      setLendo(false);
    } catch (e) {
      setLendo(false);
      avisarErro(e);
    }
  }

  // Busca o que já existe no banco para comparar (duplicados e contas fixas).
  useEffect(() => {
    if (!casa || !arquivo) return;
    let cancelado = false;
    (async () => {
      const datas = arquivo.lancamentos.map((l) => l.data).sort();
      const de = somarDiasISO(datas[0], -3);
      const ate = somarDiasISO(datas[datas.length - 1], 3);
      const ids = arquivo.lancamentos.map((l) => l.id);

      // Tudo lido da cópia do celular (funciona sem internet).
      const daCasa = (t: "gastos" | "contas_fixas" | "contas_pagamentos") => linhasLocais(t).filter((l) => l.casa_id === casa.id);
      const gastosCasa = daCasa("gastos");
      const idsArquivo = new Set(ids);
      const jaImportados = new Set<string>(gastosCasa.map((g) => g.importacao_id).filter((x): x is string => !!x && idsArquivo.has(x)));
      const ex = gastosCasa.filter((g) => g.data >= de && g.data <= ate);
      // Parcelas já lançadas (de faturas anteriores ou à mão) a partir de ~2 meses antes do arquivo.
      const parc = gastosCasa.filter((g) => g.parcelas != null && g.data >= somarDiasISO(datas[0], -62));

      const meses = [...new Set(datas.map((d) => d.slice(0, 7)))];
      const comps = meses.map((m) => competencia(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1));
      const contas = daCasa("contas_fixas").filter((c) => c.ativa !== false);
      const pags = daCasa("contas_pagamentos").filter((p) => comps.includes(p.competencia));
      const pagas = new Set((pags ?? []).map((p) => `${p.conta_id}|${p.competencia}`));
      const contasAbertas = comps.flatMap((comp) =>
        (contas ?? [])
          .filter((c) => !pagas.has(`${c.id}|${comp}`) && periodoNoMes(c, comp))
          .map((c) => ({ id: c.id, nome: c.nome, dia_vencimento: c.dia_vencimento, categoria_id: c.categoria_id, valor: c.valor == null ? null : Number(c.valor), competencia: comp })),
      );

      if (!cancelado)
        setContexto({
          jaImportados,
          // gastos que vieram de importação não contam como "lançado à mão"
          existentes: (ex ?? []).filter((g) => !g.importacao_id).map((g) => ({ data: g.data, valor: Number(g.valor), cartao_id: g.cartao_id })),
          contasAbertas,
          parcelasLancadas: (parc ?? []).map((g) => ({ cartao_id: g.cartao_id, valor: Number(g.valor), parcela: g.parcela, parcelas: g.parcelas })),
        });
    })();
    return () => {
      cancelado = true;
    };
  }, [casa?.id, arquivo]);

  const preparo = useMemo(() => {
    if (!arquivo || !contexto) return null;
    return preparar({
      lancamentos: arquivo.lancamentos,
      tipo,
      inicioFatura: fatura?.inicio,
      fimFatura: fatura?.fechamento,
      cartaoId,
      jaImportados: contexto.jaImportados,
      existentes: contexto.existentes,
      contasAbertas: contexto.contasAbertas,
      parcelasLancadas: contexto.parcelasLancadas,
    });
  }, [arquivo, contexto, tipo, fatura, cartaoId]);

  const categoriaPorIcone = new Map(categorias.map((c) => [c.icone, c.id]));
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const contaPorId = new Map((contexto?.contasAbertas ?? []).map((c) => [c.id, c]));

  function estado(item: ItemImportacao) {
    const a = ajustes[item.id] ?? {};
    const incluir = item.jaImportado ? false : (a.incluir ?? item.incluir);
    const baixa = !!item.contaBaixa && (a.baixa ?? true);
    const categoriaId =
      a.categoriaId !== undefined
        ? a.categoriaId
        : baixa && item.contaBaixa
          ? (contaPorId.get(item.contaBaixa.contaId)?.categoria_id ?? categoriaPorIcone.get("receipt") ?? null)
          : (categoriaPorIcone.get(item.iconeSugerido) ?? null);
    return { incluir, baixa, categoriaId };
  }

  function ajustar(id: string, a: Ajuste) {
    setAjustes((atual) => ({ ...atual, [id]: { ...atual[id], ...a } }));
  }

  const selecionados = (preparo?.itens ?? []).filter((i) => estado(i).incluir);
  const totalSelecionado = selecionados.reduce((s, i) => s + i.valor, 0);

  async function importar() {
    if (!casa || !preparo) return;
    if (tipo === "fatura" && !cartaoId) return Alert.alert("Cartão", "Escolha de qual cartão é essa fatura.");
    if (tipo === "extrato" && !banco) return Alert.alert("Banco", "Escolha de qual banco é esse extrato (fica no histórico de importações).");
    if (!selecionados.length) return Alert.alert("Nada selecionado", "Marque os lançamentos que quer importar.");

    setImportando(true);
    try {
      // Compra parcelada ("Parcela 3/5"): lança a 3 agora e já cria a 4 e a 5 nas
      // faturas seguintes. Na próxima importação, a "4/5" é reconhecida e não duplica.
      const linhas = selecionados.flatMap((i) => {
        const base = {
          casa_id: casa.id,
          valor: i.valor,
          descricao: (i.parcela ? descricaoSemParcela(i.descricao) : i.descricao).slice(0, 200),
          categoria_id: estado(i).categoriaId,
          forma_pagamento: i.forma,
          cartao_id: tipo === "fatura" ? cartaoId : null,
          pago_por: userId,
        };
        type Linha = typeof base & { data: string; importacao_id: string | null; parcelamento_id?: string; parcela?: number; parcelas?: number };
        if (!i.parcela || tipo !== "fatura") return [{ ...base, data: i.data, descricao: i.descricao.slice(0, 200), importacao_id: i.id } as Linha];
        const [atual, total] = i.parcela.split("/").map(Number);
        const grupo = gerarUuid();
        const lista: Linha[] = [{ ...base, data: i.data, importacao_id: i.id, parcelamento_id: grupo, parcela: atual, parcelas: total }];
        for (let k = atual + 1; k <= total; k++) {
          lista.push({ ...base, data: somarMeses(i.data, k - atual), importacao_id: null, parcelamento_id: grupo, parcela: k, parcelas: total });
        }
        return lista;
      });
      const futuras = linhas.length - selecionados.length;
      // Grava no celular e sobe na sincronização.
      const criados = inserirVarios("gastos", linhas);

      const gastoPorImportacao = new Map((criados ?? []).map((g) => [g.importacao_id, g.id]));
      const baixas = selecionados
        .filter((i) => i.contaBaixa && estado(i).baixa)
        .map((i) => ({
          conta_id: i.contaBaixa!.contaId,
          casa_id: casa.id,
          competencia: i.contaBaixa!.competencia,
          valor: i.valor,
          pago_em: i.dataOriginal,
          gasto_id: gastoPorImportacao.get(i.id) ?? null,
        }));
      inserirVarios("contas_pagamentos", baixas);

      // Histórico: qual arquivo subiu, quando e por quem.
      const datas = selecionados.map((i) => i.data).sort();
      inserir("importacoes", {
        casa_id: casa.id,
        arquivo: nomeArquivo || null,
        formato: arquivo?.formato ?? null,
        banco: tipo === "fatura" ? (cartao?.nome ?? null) : banco,
        tipo,
        cartao_id: tipo === "fatura" ? cartaoId : null,
        lancamentos: selecionados.length,
        total: Math.round(totalSelecionado * 100) / 100,
        periodo_inicio: datas[0] ?? null,
        periodo_fim: datas[datas.length - 1] ?? null,
        created_by: userId,
      });

      Alert.alert(
        "Importado!",
        `${selecionados.length} lançamentos (${formatarReais(totalSelecionado)})` +
          (futuras ? `, mais ${futuras} parcelas futuras lançadas nas próximas faturas` : "") +
          (baixas.length ? ` e ${baixas.length} contas marcadas como pagas` : "") +
          ".",
        [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } finally {
      setImportando(false);
    }
  }

  if (!arquivo) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
        <Text style={typography.body}>
          Baixe no app do seu banco o <Text style={{ fontWeight: "700" }}>extrato da conta</Text> ou a <Text style={{ fontWeight: "700" }}>fatura do cartão</Text> em
          formato <Text style={{ fontWeight: "700" }}>OFX, CSV, Excel (xlsx/xls) ou PDF</Text>, salve no celular e escolha o arquivo aqui.
        </Text>
        <Botao titulo={lendo ? "Lendo..." : "📄 Escolher arquivo"} onPress={escolherArquivo} carregando={lendo} />
        {pdf && !pdf.pedindoSenha && <PdfTexto key={pdf.tentativa} base64={pdf.base64} senha={pdf.senha} onResultado={aoLerPdf} />}
        {pdf?.pedindoSenha && (
          <Cartao>
            <Text style={[typography.body, { marginBottom: spacing.sm }]}>🔒 Este PDF tem senha. Muitos bancos usam parte do CPF (ex.: os 5 primeiros números).</Text>
            <Campo rotulo="SENHA DO PDF" value={senhaDigitada} onChangeText={setSenhaDigitada} secureTextEntry autoFocus />
            <Botao
              titulo="Abrir PDF"
              carregando={lendo}
              onPress={() => {
                setLendo(true);
                setPdf({ ...pdf, senha: senhaDigitada, pedindoSenha: false, tentativa: pdf.tentativa + 1 });
              }}
            />
            <Botao titulo="Cancelar" variante="link" onPress={() => { setPdf(null); setSenhaDigitada(""); }} />
          </Cartao>
        )}
        <TouchableOpacity onPress={() => setMostrarAjuda(!mostrarAjuda)}>
          <Text style={[typography.label, { color: colors.accent }]}>{mostrarAjuda ? "▾" : "▸"} Onde encontro esse arquivo no app do banco?</Text>
        </TouchableOpacity>
        {mostrarAjuda && (
          <Cartao>
            <Text style={[typography.body, { fontSize: 14, lineHeight: 21 }]}>
              {"O nome dos menus muda de banco para banco, mas o caminho costuma ser:\n\n"}
              {"• Extrato da conta: Extrato → Exportar / Baixar / Compartilhar → escolha OFX (ou CSV) e o período.\n"}
              {"• Fatura do cartão: Cartão → Fatura → Exportar / Enviar por e-mail → CSV ou OFX.\n\n"}
              {"Se o banco mandar por e-mail, abra o e-mail no celular, baixe o anexo e depois escolha ele aqui (fica na pasta Downloads).\n\n"}
              {"Se puder escolher, prefira OFX, CSV ou Excel: são mais precisos que o PDF. O PDF funciona na maioria dos extratos, mas precisa de internet para abrir."}
            </Text>
          </Cartao>
        )}

        {importacoes.length > 0 && (
          <>
            {/* Última vez que cada extrato/cartão subiu: saber quando refazer a importação. */}
            <Text style={[typography.label, { marginTop: spacing.md }]}>ÚLTIMA ATUALIZAÇÃO DE CADA CONTA</Text>
            <Cartao style={{ paddingVertical: spacing.xs }}>
              {ultimaDeCadaOrigem(importacoes, rotulo).map((imp, i) => (
                <TouchableOpacity
                  key={imp.id}
                  onPress={() => abrirRenomear(imp)}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
                >
                  <Text style={{ fontSize: 22 }}>{imp.tipo === "fatura" ? "💳" : "🏦"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { fontWeight: "600" }]} numberOfLines={1}>
                      {rotulo(imp)}
                    </Text>
                    <Text style={typography.label}>
                      {quando(imp.created_at)} · {haQuanto(imp.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16 }}>✏️</Text>
                </TouchableOpacity>
              ))}
            </Cartao>

            <TouchableOpacity onPress={() => setVerHistorico((v) => !v)} style={{ marginTop: spacing.sm }}>
              <Text style={[typography.label, { color: colors.accent }]}>
                {verHistorico ? "▾" : "▸"} HISTÓRICO COMPLETO ({importacoes.length})
              </Text>
            </TouchableOpacity>
            {verHistorico && (
              <Cartao style={{ paddingVertical: spacing.xs }}>
                {importacoes.map((imp, i) => {
                  const periodo = imp.periodo_inicio && imp.periodo_fim ? ` · compras de ${diaMes(imp.periodo_inicio)} a ${diaMes(imp.periodo_fim)}` : "";
                  return (
                    <TouchableOpacity key={imp.id} onPress={() => abrirRenomear(imp)} style={{ paddingVertical: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={[typography.body, { flex: 1, fontWeight: "600" }]} numberOfLines={1}>
                          {imp.tipo === "fatura" ? "💳" : "🏦"} {rotulo(imp)} ✏️
                        </Text>
                        {imp.total != null && <Text style={[typography.body, { fontWeight: "600" }]}>{mostrarValor(imp.total)}</Text>}
                      </View>
                      <Text style={typography.label}>
                        Subiu {quando(imp.created_at)} · {imp.lancamentos} {imp.lancamentos === 1 ? "lançamento" : "lançamentos"}
                        {periodo}
                      </Text>
                      {imp.arquivo && (
                        <Text style={typography.label} numberOfLines={1}>
                          📎 {imp.arquivo}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </Cartao>
            )}
          </>
        )}

        <Modal visible={!!renomeando} transparent animationType="fade" onRequestClose={() => setRenomeando(null)}>
          <Pressable onPress={() => setRenomeando(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg }}>
            <Pressable style={{ backgroundColor: colors.background, borderRadius: 16, padding: spacing.lg }}>
              <Campo rotulo="NOME DESTA IMPORTAÇÃO" value={novoNome} onChangeText={setNovoNome} placeholder="Ex.: Extrato Bradesco conta salário Will" autoFocus />
              <Text style={[typography.label, { marginTop: -spacing.sm, marginBottom: spacing.md }]}>Use um nome que lembre de onde o arquivo foi tirado.</Text>
              {iguais.length > 1 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
                  <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>Usar também nas outras {iguais.length - 1} importações com o mesmo nome</Text>
                  <Switch value={renomearIguais} onValueChange={setRenomearIguais} trackColor={{ true: colors.accent, false: colors.border }} />
                </View>
              )}
              <Botao titulo="Salvar nome" onPress={() => salvarNome(novoNome)} />
              {renomeando?.nome && <Botao titulo="Voltar ao nome automático" variante="link" onPress={() => salvarNome(null)} style={{ marginTop: spacing.xs }} />}
              <Botao titulo="Cancelar" variante="link" onPress={() => setRenomeando(null)} />
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: rodape }}>
      <Cartao>
        <Text style={typography.label}>ARQUIVO</Text>
        <Text style={[typography.body, { fontWeight: "600" }]} numberOfLines={1}>{nomeArquivo}</Text>
        <Text style={typography.label}>
          {arquivo.formato.toUpperCase()}{arquivo.banco ? ` · ${arquivo.banco}` : ""} · {arquivo.lancamentos.length} lançamentos
        </Text>
        <TouchableOpacity onPress={escolherArquivo}>
          <Text style={[typography.label, { color: colors.accent, marginTop: spacing.xs }]}>Trocar arquivo</Text>
        </TouchableOpacity>
      </Cartao>
      {pdf && !pdf.pedindoSenha && <PdfTexto key={pdf.tentativa} base64={pdf.base64} senha={pdf.senha} onResultado={aoLerPdf} />}
      {pdf?.pedindoSenha && (
        <Cartao>
          <Text style={[typography.body, { marginBottom: spacing.sm }]}>🔒 Este PDF tem senha. Muitos bancos usam parte do CPF (ex.: os 5 primeiros números).</Text>
          <Campo rotulo="SENHA DO PDF" value={senhaDigitada} onChangeText={setSenhaDigitada} secureTextEntry autoFocus />
          <Botao
            titulo="Abrir PDF"
            carregando={lendo}
            onPress={() => {
              setLendo(true);
              setPdf({ ...pdf, senha: senhaDigitada, pedindoSenha: false, tentativa: pdf.tentativa + 1 });
            }}
          />
          <Botao titulo="Cancelar" variante="link" onPress={() => { setPdf(null); setSenhaDigitada(""); }} />
        </Cartao>
      )}

      <View>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>ESTE ARQUIVO É</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Chip rotulo="🏦 Extrato da conta" ativo={tipo === "extrato"} onPress={() => setTipo("extrato")} />
          <Chip rotulo="💳 Fatura do cartão" ativo={tipo === "fatura"} onPress={() => setTipo("fatura")} />
        </View>
      </View>

      {tipo === "extrato" && (
        <View>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>DE QUAL BANCO</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {BANCOS.map((b) => (
              <Chip key={b} rotulo={`🏦 ${b}`} ativo={banco === b} onPress={() => setBanco(b)} />
            ))}
          </View>
        </View>
      )}

      {tipo === "fatura" && (
        <View>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>DE QUAL CARTÃO</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {cartoes.map((c) => (
              <Chip key={c.id} rotulo={`💳 ${c.nome}`} ativo={cartaoId === c.id} onPress={() => setCartaoId(c.id)} />
            ))}
            <Chip rotulo="+ Novo cartão" ativo={false} onPress={() => navigation.navigate("CartaoForm", {})} />
          </View>
          {fatura && (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
              <TouchableOpacity onPress={() => setDeslocFatura(deslocFatura - 1)} style={{ paddingHorizontal: spacing.sm }}>
                <Text style={{ fontSize: 20, color: colors.accent }}>‹</Text>
              </TouchableOpacity>
              <Text style={[typography.label, { flex: 1, textAlign: "center" }]}>
                Fatura de {MESES[Number(fatura.vencimento.slice(5, 7)) - 1]} · fecha {diaMes(fatura.fechamento)} · vence {diaMes(fatura.vencimento)}
              </Text>
              <TouchableOpacity onPress={() => setDeslocFatura(deslocFatura + 1)} style={{ paddingHorizontal: spacing.sm }}>
                <Text style={{ fontSize: 20, color: colors.accent }}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {!preparo ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      ) : (
        <>
          <Text style={typography.label}>
            {preparo.itens.length} despesas encontradas
            {preparo.ignorados ? ` · ${preparo.ignorados} ${tipo === "extrato" ? "entradas" : "pagamentos/estornos"} ignorados` : ""}. Toque no emoji para trocar a categoria.
          </Text>
          <Cartao style={{ paddingVertical: spacing.xs }}>
            {preparo.itens.map((item, idx) => {
              const e = estado(item);
              const cat = e.categoriaId ? categoriaPorId.get(e.categoriaId) : undefined;
              return (
                <View key={item.id} style={{ paddingVertical: spacing.sm, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: colors.border, opacity: e.incluir ? 1 : 0.55 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity
                      disabled={item.jaImportado}
                      onPress={() => ajustar(item.id, { incluir: !e.incluir })}
                      style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: e.incluir ? colors.accent : colors.border, backgroundColor: e.incluir ? colors.accent : "transparent", alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}
                    >
                      {e.incluir && <Text style={{ color: colors.accentContrast, fontWeight: "700" }}>✓</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAbertoCategoria(abertoCategoria === item.id ? null : item.id)} style={{ marginRight: spacing.sm }}>
                      <Text style={{ fontSize: 22 }}>{emojiCategoria(cat?.icone)}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.body} numberOfLines={2}>{item.descricao}</Text>
                      <Text style={typography.label}>
                        {diaMes(item.data)}
                        {item.data !== item.dataOriginal ? ` (compra ${diaMes(item.dataOriginal)})` : ""}
                        {item.parcela ? ` · parcela ${item.parcela}` : ""}
                        {cat ? ` · ${cat.nome}` : ""}
                      </Text>
                    </View>
                    <Text style={[typography.body, { fontWeight: "600", marginLeft: spacing.sm }]}>{formatarReais(item.valor)}</Text>
                  </View>
                  {item.aviso && <Text style={[typography.label, { color: colors.warning, marginLeft: 36, marginTop: 2 }]}>⚠️ {item.aviso}</Text>}
                  {item.contaBaixa && e.incluir && (
                    <TouchableOpacity onPress={() => ajustar(item.id, { baixa: !e.baixa })} style={{ marginLeft: 36, marginTop: 4 }}>
                      <Text style={[typography.label, { color: e.baixa ? colors.accent : colors.textSecondary }]}>
                        {e.baixa ? "☑" : "☐"} Marcar a conta "{item.contaBaixa.nome}" como paga{item.contaBaixa.porNome ? "" : " (mesmo valor)"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {abertoCategoria === item.id && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm, marginLeft: 36 }}>
                      {categorias.map((c) => (
                        <Chip
                          key={c.id}
                          rotulo={`${emojiCategoria(c.icone)} ${c.nome}`}
                          cor={c.cor}
                          ativo={e.categoriaId === c.id}
                          onPress={() => {
                            ajustar(item.id, { categoriaId: c.id });
                            setAbertoCategoria(null);
                          }}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </Cartao>

          <Botao
            titulo={`Importar ${selecionados.length} ${selecionados.length === 1 ? "despesa" : "despesas"} · ${formatarReais(totalSelecionado)}`}
            onPress={importar}
            carregando={importando}
          />
        </>
      )}
    </ScrollView>
  );
}
