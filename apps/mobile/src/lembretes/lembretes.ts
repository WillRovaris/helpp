import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { competencia } from "../lib/contas";
import { linhas } from "../offline/banco";
import { hojeISO } from "../lib/format";
import { lembreteFechamento, lembretesNoturnos, planejarLembretes } from "./planejar";

const CHAVE = "@helpp/lembretes";
const CANAL = "lembretes";

export interface ConfigLembretes {
  ativo: boolean;
  hora: number;
  /** Lembrete à noite para lançar as despesas do dia. */
  noturno: boolean;
  horaNoturno: number;
}

const PADRAO: ConfigLembretes = { ativo: true, hora: 9, noturno: false, horaNoturno: 21 };

// Notificação que chega com o app aberto também aparece.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function lerConfigLembretes(): Promise<ConfigLembretes> {
  try {
    const v = await AsyncStorage.getItem(CHAVE);
    return v ? { ...PADRAO, ...JSON.parse(v) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

export async function salvarConfigLembretes(c: ConfigLembretes, casaId: string | undefined): Promise<void> {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(c));
  if (casaId) await reagendarLembretes(casaId, true);
}

let ultimo = 0;
let ultimoLancou: boolean | null = null;

/** Alguém da casa já lançou despesa hoje (data de hoje ou registrada hoje)? */
function lancouHoje(casaId: string): boolean {
  const hoje = hojeISO();
  return linhas("gastos").some((g) => g.casa_id === casaId && (g.data === hoje || (g.created_at && new Date(g.created_at).toDateString() === new Date().toDateString())));
}

/**
 * Refaz todos os lembretes a partir dos dados atuais (contas abertas e cartões).
 * Chamado ao abrir a tela inicial; no máximo uma vez por minuto, a não ser que `forcar`.
 */
export async function reagendarLembretes(casaId: string, forcar = false): Promise<void> {
  // Lançou a primeira despesa do dia: refaz na hora (o lembrete da noite de hoje sai).
  const lancou = lancouHoje(casaId);
  if (!forcar && Date.now() - ultimo < 60_000 && lancou === ultimoLancou) return;
  ultimo = Date.now();
  ultimoLancou = lancou;
  try {
    const config = await lerConfigLembretes();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!config.ativo && !config.noturno) return;

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) return;
      const pedido = await Notifications.requestPermissionsAsync();
      if (!pedido.granted) return;
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CANAL, { name: "Lembretes de contas e faturas", importance: Notifications.AndroidImportance.HIGH });
    }

    const agora = new Date();
    const comps = [competencia(agora.getFullYear(), agora.getMonth()), competencia(agora.getFullYear(), agora.getMonth() + 1)];
    // Lido da cópia do celular (funciona sem internet).
    const daCasa = (t: "contas_fixas" | "contas_pagamentos" | "cartoes" | "faturas_pagas") => linhas(t).filter((l) => l.casa_id === casaId);
    const contas = daCasa("contas_fixas").filter((c) => c.ativa !== false);
    const pags = daCasa("contas_pagamentos").filter((p) => comps.includes(p.competencia));
    const cartoes = daCasa("cartoes")
      .filter((c) => !c.arquivado)
      .map((c) => ({ id: c.id, nome: c.nome, dia_fechamento: c.dia_fechamento, dia_vencimento: c.dia_vencimento }));
    const faturasPagas = daCasa("faturas_pagas");

    const lembretes = !config.ativo ? [] : planejarLembretes({
      agora,
      hora: config.hora,
      competencias: comps,
      contas: contas.map((c) => ({ id: c.id, nome: c.nome, dia_vencimento: c.dia_vencimento, inicio: c.inicio, meses: c.meses, valor: c.valor == null ? null : Number(c.valor) })),
      pagas: new Set((pags ?? []).map((p) => `${p.conta_id}|${p.competencia}`)),
      cartoes: cartoes ?? [],
      faturasPagas: new Set((faturasPagas ?? []).map((p) => `${p.cartao_id}|${p.vencimento}`)),
    });

    // Fechamento do mês: aviso no dia 1 do mês seguinte (fica na frente da lista para nunca ser cortado).
    const todos = [
      ...(config.ativo ? [lembreteFechamento(agora, config.hora)] : []),
      ...(config.noturno ? lembretesNoturnos(agora, config.horaNoturno, lancou) : []),
      ...lembretes,
    ];

    // Android limita a quantidade de alarmes por app; 60 sobra para 2 meses.
    for (const l of todos.slice(0, 60)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: l.titulo, body: l.corpo, data: { tela: l.tela } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: l.quando, channelId: CANAL },
      });
    }
  } catch {
    // Lembrete é ajuda extra: se falhar, o app segue normal.
  }
}
