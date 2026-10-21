import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { competencia } from "../lib/contas";
import { supabase } from "../lib/supabase";
import { planejarLembretes } from "./planejar";

const CHAVE = "@helpp/lembretes";
const CANAL = "lembretes";

export interface ConfigLembretes {
  ativo: boolean;
  hora: number;
}

const PADRAO: ConfigLembretes = { ativo: true, hora: 9 };

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

/**
 * Refaz todos os lembretes a partir dos dados atuais (contas abertas e cartões).
 * Chamado ao abrir a tela inicial; no máximo uma vez por minuto, a não ser que `forcar`.
 */
export async function reagendarLembretes(casaId: string, forcar = false): Promise<void> {
  if (!forcar && Date.now() - ultimo < 60_000) return;
  ultimo = Date.now();
  try {
    const config = await lerConfigLembretes();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!config.ativo) return;

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
    const [{ data: contas }, { data: pags }, { data: cartoes }, { data: faturasPagas }] = await Promise.all([
      supabase.from("contas_fixas").select("*").eq("casa_id", casaId).eq("ativa", true),
      supabase.from("contas_pagamentos").select("conta_id, competencia").eq("casa_id", casaId).in("competencia", comps),
      supabase.from("cartoes").select("id, nome, dia_fechamento, dia_vencimento").eq("casa_id", casaId).eq("arquivado", false),
      // sem o SQL 05 volta erro e data = null: segue sem filtrar
      supabase.from("faturas_pagas").select("cartao_id, vencimento").eq("casa_id", casaId),
    ]);

    const lembretes = planejarLembretes({
      agora,
      hora: config.hora,
      competencias: comps,
      contas: (contas ?? []).map((c) => ({ ...c, valor: c.valor == null ? null : Number(c.valor) })),
      pagas: new Set((pags ?? []).map((p) => `${p.conta_id}|${p.competencia}`)),
      cartoes: cartoes ?? [],
      faturasPagas: new Set((faturasPagas ?? []).map((p) => `${p.cartao_id}|${p.vencimento}`)),
    });

    // Android limita a quantidade de alarmes por app; 60 sobra para 2 meses.
    for (const l of lembretes.slice(0, 60)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: l.titulo, body: l.corpo, data: { tela: l.tela } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: l.quando, channelId: CANAL },
      });
    }
  } catch {
    // Lembrete é ajuda extra: se falhar, o app segue normal.
  }
}
