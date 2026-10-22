import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { supabase } from "../lib/supabase";
import { gravarMeta, lerMeta, type Linha, tamanhoFila } from "./banco";
import { quandoGravar } from "./repo";
import { sincronizar } from "./sync";

interface EstadoSync {
  sincronizando: boolean;
  /** null = ainda não tentou. */
  online: boolean | null;
  ultimaSync: string | null;
  pendentes: number;
  /** Despesas novas de outra pessoa da casa, desde a última vez que a pessoa viu o aviso. */
  novidades: Linha[];
  novidadesDesde: string | null;
  sincronizarAgora: () => void;
  limparNovidades: () => void;
}

const Contexto = createContext<EstadoSync | undefined>(undefined);

/**
 * Sincroniza sozinho (sem perguntar): ao abrir, ao voltar para o app, a cada
 * minuto, logo depois de cada gravação e quando o outro celular muda algo.
 */
export function SincronizacaoProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { casa } = useCasa();
  const casaId = casa?.id ?? null;
  const [sincronizando, setSincronizando] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [novidades, setNovidades] = useState<Linha[]>([]);
  const [novidadesDesde, setNovidadesDesde] = useState<string | null>(null);
  const deNovo = useRef(false);
  const rodando = useRef(false);

  // Ao trocar de casa: lê o que ficou guardado da última vez.
  useEffect(() => {
    if (!casaId) return;
    setUltimaSync(lerMeta(`ultima_sync:${casaId}`));
    setPendentes(tamanhoFila());
    try {
      const salvas = lerMeta(`novidades:${casaId}`);
      setNovidades(salvas ? JSON.parse(salvas) : []);
    } catch {
      setNovidades([]);
    }
    setNovidadesDesde(lerMeta(`novidades_desde:${casaId}`));
  }, [casaId]);

  const rodar = useCallback(async () => {
    if (!casaId) return;
    if (rodando.current) {
      deNovo.current = true; // pediram de novo no meio: roda mais uma vez no fim
      return;
    }
    rodando.current = true;
    setSincronizando(true);
    const antes = lerMeta(`ultima_sync:${casaId}`);
    try {
      do {
        deNovo.current = false;
        const r = await sincronizar(casaId, userId);
        setOnline(r.online);
        if (r.online) setUltimaSync(lerMeta(`ultima_sync:${casaId}`));
        if (r.novasDeOutros.length) {
          setNovidades((atual) => {
            const juntas = [...atual, ...r.novasDeOutros.filter((n) => !atual.some((a) => a.id === n.id))];
            gravarMeta(`novidades:${casaId}`, JSON.stringify(juntas));
            return juntas;
          });
          setNovidadesDesde((atual) => {
            const desde = atual ?? antes;
            gravarMeta(`novidades_desde:${casaId}`, desde);
            return desde;
          });
        }
      } while (deNovo.current);
    } finally {
      rodando.current = false;
      setSincronizando(false);
      setPendentes(tamanhoFila());
    }
  }, [casaId, userId]);

  // Depois de cada gravação: mostra "aguardando" e tenta subir logo (pequena espera para juntar várias).
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    quandoGravar(() => {
      setPendentes(tamanhoFila());
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => rodar(), 800);
    });
    return () => quandoGravar(() => {});
  }, [rodar]);

  // Ao abrir, ao voltar para o app e a cada minuto.
  useEffect(() => {
    if (!casaId) return;
    rodar();
    const intervalo = setInterval(rodar, 60_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") rodar();
    });
    return () => {
      clearInterval(intervalo);
      sub.remove();
    };
  }, [casaId, rodar]);

  // O outro celular mudou algo na nuvem: busca na hora.
  useEffect(() => {
    if (!casaId) return;
    const canal = supabase.channel(`sync-${casaId}`);
    for (const t of ["gastos", "categorias", "cartoes", "contas_fixas", "contas_pagamentos", "faturas_pagas", "notas", "exclusoes"]) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `casa_id=eq.${casaId}` }, () => rodar());
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [casaId, rodar]);

  const limparNovidades = useCallback(() => {
    setNovidades([]);
    setNovidadesDesde(null);
    if (casaId) {
      gravarMeta(`novidades:${casaId}`, null);
      gravarMeta(`novidades_desde:${casaId}`, null);
    }
  }, [casaId]);

  return (
    <Contexto.Provider value={{ sincronizando, online, ultimaSync, pendentes, novidades, novidadesDesde, sincronizarAgora: rodar, limparNovidades }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSincronizacao(): EstadoSync {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useSincronizacao deve ser usado dentro de SincronizacaoProvider");
  return ctx;
}
