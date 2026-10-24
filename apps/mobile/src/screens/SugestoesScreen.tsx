import React, { useState } from "react";
import * as Updates from "expo-updates";
import { Alert, Platform, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Cartao, estiloInput, TelaFormulario } from "../components/ui";
import { useSugestoes } from "../data/hooks";
import type { Sugestao } from "../data/tipos";
import { dataISO, rotuloDia } from "../lib/format";
import { atualizar, excluir, inserir } from "../offline/repo";
import { colors, spacing, typography } from "../theme";

// Sugestões e melhorias: quem usa o app anota ideias; todos da casa veem a lista.
// O dono envia as pendentes para o Claude (compartilhar) e marca como feita quando a melhoria chega no app.
export function SugestoesScreen() {
  const { userId } = useAuth();
  const { casa, membros } = useCasa();
  const { pendentes, feitas } = useSugestoes();
  const [texto, setTexto] = useState("");
  const [verFeitas, setVerFeitas] = useState(false);

  const nomeDe = (id: string | null) => membros.find((m) => m.user_id === id)?.nome ?? "";
  const quando = (s: Sugestao) => rotuloDia(dataISO(new Date(s.created_at)));

  function enviar() {
    const t = texto.trim();
    if (!casa || !t) return;
    inserir("sugestoes", { casa_id: casa.id, texto: t, feita: false, created_by: userId, versao_app: versaoDoApp(), dispositivo: modeloDoCelular() });
    setTexto("");
  }

  function marcar(s: Sugestao, feita: boolean) {
    atualizar("sugestoes", s.id, { feita, feita_em: feita ? new Date().toISOString() : null });
  }

  function apagar(s: Sugestao) {
    Alert.alert("Apagar sugestão?", s.texto, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => excluir("sugestoes", [s.id]) },
    ]);
  }

  function compartilhar() {
    const lista = pendentes.map((s, i) => `${i + 1}. ${s.texto}${membros.length > 1 ? ` (${nomeDe(s.created_by)}, ${quando(s)})` : ""}`).join("\n");
    Share.share({ message: `Sugestões para o Helpp:\n\n${lista}` });
  }

  return (
    <TelaFormulario contentStyle={{ gap: spacing.md }}>
      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.xs }]}>O QUE PODERIA SER MELHOR NO APP?</Text>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder="Ex.: queria ver quanto gastei em cada mercado"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[estiloInput(), { minHeight: 90, textAlignVertical: "top" }]}
        />
        <Botao titulo="Enviar sugestão" onPress={enviar} style={{ marginTop: spacing.md }} />
        <Text style={[typography.label, { marginTop: spacing.sm }]}>
          🔒 A sugestão vai para a equipe do Helpp (helppsuporte@gmail.com) com seu nome e e-mail, para podermos responder. Nada dos seus gastos é enviado.
        </Text>
      </Cartao>

      <Text style={typography.label}>PENDENTES ({pendentes.length})</Text>
      {pendentes.length === 0 ? (
        <Text style={[typography.label, { textAlign: "center", paddingVertical: spacing.md }]}>Nenhuma sugestão pendente.</Text>
      ) : (
        <Cartao style={{ paddingVertical: spacing.xs }}>
          {pendentes.map((s, i) => (
            <LinhaSugestao key={s.id} s={s} borda={i > 0} autor={membros.length > 1 ? nomeDe(s.created_by) : ""} quando={quando(s)}>
              <BotaoPequeno rotulo="✅ Feita" onPress={() => marcar(s, true)} />
              {s.created_by === userId && <BotaoPequeno rotulo="🗑" onPress={() => apagar(s)} perigo />}
            </LinhaSugestao>
          ))}
        </Cartao>
      )}
      {pendentes.length > 0 && <Botao titulo="📤 Enviar lista de pendentes" variante="secundario" onPress={compartilhar} />}

      {feitas.length > 0 && (
        <>
          <TouchableOpacity onPress={() => setVerFeitas((v) => !v)}>
            <Text style={[typography.label, { color: colors.accent }]}>
              {verFeitas ? "▾" : "▸"} JÁ FEITAS ({feitas.length})
            </Text>
          </TouchableOpacity>
          {verFeitas && (
            <Cartao style={{ paddingVertical: spacing.xs }}>
              {feitas.map((s, i) => (
                <LinhaSugestao key={s.id} s={s} borda={i > 0} autor={membros.length > 1 ? nomeDe(s.created_by) : ""} quando={quando(s)} feita>
                  <BotaoPequeno rotulo="↺ Voltar" onPress={() => marcar(s, false)} />
                </LinhaSugestao>
              ))}
            </Cartao>
          )}
        </>
      )}
    </TelaFormulario>
  );
}

/** "1.3.0 · atualização de 24/10" — versão do APK + data da atualização automática que está rodando. */
function versaoDoApp(): string {
  const base = Updates.runtimeVersion ?? "?";
  return Updates.createdAt ? `${base} · atualização de ${Updates.createdAt.toLocaleDateString("pt-BR")}` : base;
}

/** "samsung SM-G780G · Android 13". */
function modeloDoCelular(): string {
  const c = Platform.constants as { Brand?: string; Model?: string; Release?: string };
  return [c.Brand, c.Model].filter(Boolean).join(" ") + (c.Release ? ` · Android ${c.Release}` : "");
}

function LinhaSugestao({ s, borda, autor, quando, feita, children }: { s: Sugestao; borda: boolean; autor: string; quando: string; feita?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: spacing.sm, borderTopWidth: borda ? 1 : 0, borderTopColor: colors.border }}>
      <Text style={[typography.body, { textDecorationLine: feita ? "line-through" : "none", opacity: feita ? 0.6 : 1 }]}>{s.texto}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs }}>
        <Text style={[typography.label, { flex: 1 }]}>{autor ? `${autor} · ${quando}` : quando}</Text>
        {children}
      </View>
    </View>
  );
}

function BotaoPequeno({ rotulo, onPress, perigo }: { rotulo: string; onPress: () => void; perigo?: boolean }) {
  const cor = perigo ? colors.danger : colors.accent;
  return (
    <TouchableOpacity onPress={onPress} style={{ borderWidth: 1, borderColor: cor, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
      <Text style={{ color: cor, fontWeight: "600", fontSize: 13 }}>{rotulo}</Text>
    </TouchableOpacity>
  );
}
