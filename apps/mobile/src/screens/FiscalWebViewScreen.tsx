import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { apiFetch, ApiError } from "../api/client";
import type { ImportedReceipt, RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "FiscalWebView">;

// Extrai o HTML renderizado da página atual da WebView. O fetch acontece aqui,
// no contexto de um navegador de verdade (cookies + JS), não no backend — é a
// única forma viável de passar pelo gate de segurança da SEFAZ (ver DECISIONS.md #2).
const EXTRACT_HTML_SCRIPT = `
  window.ReactNativeWebView.postMessage(document.documentElement.outerHTML);
  true;
`;

function buildConsultaUrl(qrContent: string): string {
  if (qrContent.startsWith("http")) return qrContent;
  return `http://sat.sef.sc.gov.br/nfce/consulta?p=${qrContent}`;
}

export function FiscalWebViewScreen({ route, navigation }: Props) {
  const { qrContent } = route.params;
  const webviewRef = useRef<WebView>(null);
  const [importing, setImporting] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleHtmlExtracted(html: string) {
    setImporting(true);
    try {
      const result = await apiFetch<ImportedReceipt>("/api/receipts/import", {
        method: "POST",
        body: JSON.stringify({ qrContent, html }),
      });
      navigation.replace("Confirmation", { result });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Não conseguimos processar a nota.";
      Alert.alert("Ops", message, [{ text: "Tentar novamente", onPress: () => setImporting(false) }]);
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri: buildConsultaUrl(qrContent) }}
        onMessage={(event) => handleHtmlExtracted(event.nativeEvent.data)}
      />

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Text style={[typography.body, { textAlign: "center", marginBottom: spacing.sm }]}>
          Se aparecer um captcha, resolva normalmente. Quando os produtos da nota aparecerem na tela, toque abaixo.
        </Text>
        <TouchableOpacity
          style={styles.button}
          disabled={importing}
          onPress={() => webviewRef.current?.injectJavaScript(EXTRACT_HTML_SCRIPT)}
        >
          {importing ? <ActivityIndicator color={colors.accentContrast} /> : <Text style={styles.buttonText}>Importar esta nota</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  buttonText: { color: colors.accentContrast, fontWeight: "700", fontSize: 16 },
});
