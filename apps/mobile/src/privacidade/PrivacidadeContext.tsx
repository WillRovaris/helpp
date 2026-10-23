import React, { createContext, useCallback, useContext, useState } from "react";
import { Image, TouchableOpacity } from "react-native";
import { formatarReais } from "../lib/format";
import { colors } from "../theme";

interface Privacidade {
  /** Valores em dinheiro aparecem? Começa escondido toda vez que o app abre. */
  visivel: boolean;
  alternar: () => void;
  /** Valor formatado, ou "R$ •••••" quando escondido. Usar só em telas de consulta (não em campos de digitação). */
  mostrarValor: (valor: number) => string;
}

const Contexto = createContext<Privacidade | undefined>(undefined);

/**
 * Modo privacidade (como nos apps de banco): para mostrar o app a alguém sem
 * expor os valores. Percentuais, nomes e datas continuam aparecendo.
 */
export function PrivacidadeProvider({ children }: { children: React.ReactNode }) {
  const [visivel, setVisivel] = useState(false);
  const alternar = useCallback(() => setVisivel((v) => !v), []);
  const mostrarValor = useCallback((valor: number) => (visivel ? formatarReais(valor) : "R$ •••••"), [visivel]);
  return <Contexto.Provider value={{ visivel, alternar, mostrarValor }}>{children}</Contexto.Provider>;
}

export function usePrivacidade(): Privacidade {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("usePrivacidade deve ser usado dentro de PrivacidadeProvider");
  return ctx;
}

/** Botão do olho: fechado = valores escondidos, aberto = visíveis. Cor segue o tema. */
export function BotaoOlho({ tamanho = 26 }: { tamanho?: number }) {
  const { visivel, alternar } = usePrivacidade();
  return (
    <TouchableOpacity onPress={alternar} style={{ padding: 8 }} accessibilityLabel={visivel ? "Esconder valores" : "Mostrar valores"} hitSlop={8}>
      <Image
        source={visivel ? require("../../assets/olho-aberto.png") : require("../../assets/olho-fechado.png")}
        style={{ width: tamanho, height: tamanho, tintColor: colors.textPrimary }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}
