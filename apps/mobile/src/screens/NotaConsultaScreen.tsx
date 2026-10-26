import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { Botao } from "../components/ui";
import { ehEnderecoDoGoverno, type MensagemExtracao, SCRIPT_EXTRAIR_NOTA, urlConsultaSegura } from "../fiscal/nfce";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "NotaConsulta">;

// Abre a consulta pública da SEFAZ. A cada página carregada tenta ler a nota
// sozinho; se aparecer captcha, a pessoa resolve e a leitura acontece na
// página seguinte. O botão serve de reserva caso a leitura automática não dispare.
export function NotaConsultaScreen({ navigation, route }: Props) {
  const { qr } = route.params;
  const webview = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const [tentouManual, setTentouManual] = useState(false);
  const pronto = useRef(false);
  // Segurança: só abre QR que aponta para site do governo (QR falso colado por cima não abre página qualquer).
  const url = urlConsultaSegura(qr);

  useEffect(() => {
    if (url) return;
    Alert.alert("QR Code não reconhecido", "Esse QR Code não é de uma nota fiscal (o endereço não é de um site do governo). Por segurança, ele não foi aberto.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }, [url, navigation]);

  function aoReceber(dados: string) {
    let msg: MensagemExtracao;
    try {
      msg = JSON.parse(dados);
    } catch {
      return;
    }
    if (msg.tipo !== "nota" || pronto.current) return;
    if (msg.ok) {
      pronto.current = true;
      navigation.replace("NotaConfirmar", { qr, nota: msg.nota });
    } else if (tentouManual) {
      setTentouManual(false);
      Alert.alert(
        "Ainda não deu para ler",
        "Os produtos da nota precisam estar aparecendo na tela. Se tiver captcha, resolva primeiro. Se a página for de outro estado e não funcionar, você pode lançar a despesa à mão.",
        [
          { text: "Continuar tentando", style: "cancel" },
          { text: "Lançar à mão", onPress: () => navigation.replace("GastoForm", {}) },
        ],
      );
    }
  }

  if (!url) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <WebView
        ref={webview}
        source={{ uri: url }}
        // Navegação só dentro de sites do governo (o captcha roda em quadro interno, que é liberado).
        onShouldStartLoadWithRequest={(req) => req.isTopFrame === false || req.url === "about:blank" || ehEnderecoDoGoverno(req.url)}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        onLoadEnd={() => webview.current?.injectJavaScript(SCRIPT_EXTRAIR_NOTA)}
        onMessage={(e) => aoReceber(e.nativeEvent.data)}
      />
      <View style={{ padding: spacing.md, paddingBottom: spacing.md + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={[typography.label, { textAlign: "center", marginBottom: spacing.sm }]}>
          Se aparecer um captcha, resolva. A nota é lida sozinha quando os produtos aparecerem.
        </Text>
        <Botao
          titulo="Ler nota agora"
          onPress={() => {
            setTentouManual(true);
            webview.current?.injectJavaScript(SCRIPT_EXTRAIR_NOTA);
          }}
        />
      </View>
    </View>
  );
}
