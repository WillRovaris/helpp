import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { aplicarPaleta, PALETA_CLARA, PALETA_ESCURA } from "../theme";

export type PreferenciaTema = "sistema" | "claro" | "escuro";

const CHAVE = "@helpp/tema";

interface TemaContextValue {
  preferencia: PreferenciaTema;
  escuro: boolean;
  escolher: (p: PreferenciaTema) => void;
}

const TemaContext = createContext<TemaContextValue | undefined>(undefined);

/**
 * Tema é preferência do aparelho (cada pessoa escolhe no seu celular).
 * Ao mudar, troca a paleta e remonta a árvore (key) para todas as telas
 * lerem as cores novas.
 */
export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema>("sistema");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => {
        if (v === "claro" || v === "escuro" || v === "sistema") setPreferencia(v);
      })
      .finally(() => setCarregado(true));
  }, []);

  const escuro = preferencia === "escuro" || (preferencia === "sistema" && sistema === "dark");
  aplicarPaleta(escuro ? PALETA_ESCURA : PALETA_CLARA);

  function escolher(p: PreferenciaTema) {
    setPreferencia(p);
    AsyncStorage.setItem(CHAVE, p).catch(() => {});
  }

  if (!carregado) return null;

  return (
    <TemaContext.Provider value={{ preferencia, escuro, escolher }}>
      <StatusBar style={escuro ? "light" : "dark"} />
      <React.Fragment key={escuro ? "escuro" : "claro"}>{children}</React.Fragment>
    </TemaContext.Provider>
  );
}

export function useTema(): TemaContextValue {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema deve ser usado dentro de TemaProvider");
  return ctx;
}
