import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing, typography } from "../theme";
import { Botao } from "./ui";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * Calendário de meses: ano com ‹ › e os 12 meses para tocar.
 * Trabalha com competência (YYYY-MM-01). `minimo` desabilita meses antes dele.
 */
export function SeletorMes({
  visivel,
  titulo,
  valor,
  minimo,
  onEscolher,
  onFechar,
  rotuloLimpar,
  onLimpar,
}: {
  visivel: boolean;
  titulo: string;
  valor: string | null;
  minimo?: string | null;
  onEscolher: (competencia: string) => void;
  onFechar: () => void;
  /** Botão extra (ex.: "Sem prazo"). */
  rotuloLimpar?: string;
  onLimpar?: () => void;
}) {
  const hoje = new Date();
  const [ano, setAno] = useState(valor ? Number(valor.slice(0, 4)) : hoje.getFullYear());

  useEffect(() => {
    if (visivel) setAno(valor ? Number(valor.slice(0, 4)) : minimo ? Number(minimo.slice(0, 4)) : hoje.getFullYear());
  }, [visivel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable onPress={onFechar} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }}>
          <Text style={[typography.label, { marginBottom: spacing.sm }]}>{titulo.toUpperCase()}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
            <TouchableOpacity onPress={() => setAno(ano - 1)} style={{ padding: spacing.sm }}>
              <Text style={{ fontSize: 22, color: colors.accent }}>‹</Text>
            </TouchableOpacity>
            <Text style={[typography.body, { fontWeight: "700", fontSize: 18 }]}>{ano}</Text>
            <TouchableOpacity onPress={() => setAno(ano + 1)} style={{ padding: spacing.sm }}>
              <Text style={{ fontSize: 22, color: colors.accent }}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" }}>
            {MESES_CURTOS.map((nome, i) => {
              const comp = `${ano}-${String(i + 1).padStart(2, "0")}-01`;
              const ativo = valor === comp;
              const bloqueado = !!minimo && comp < minimo;
              return (
                <TouchableOpacity
                  key={nome}
                  disabled={bloqueado}
                  onPress={() => onEscolher(comp)}
                  style={{
                    width: "30%",
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: ativo ? colors.accent : colors.border,
                    backgroundColor: ativo ? colors.accent : "transparent",
                    opacity: bloqueado ? 0.3 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "600", color: ativo ? colors.accentContrast : colors.textPrimary }}>{nome}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {rotuloLimpar && onLimpar && <Botao titulo={rotuloLimpar} variante="secundario" onPress={onLimpar} style={{ marginTop: spacing.md }} />}
          <Botao titulo="Fechar" variante="link" onPress={onFechar} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
