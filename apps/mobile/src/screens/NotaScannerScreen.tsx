import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useRef } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Botao } from "../components/ui";
import { chaveDoQr } from "../fiscal/nfce";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing, typography } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "NotaScanner">;

export function NotaScannerScreen({ navigation }: Props) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const lido = useRef(false);

  if (!permissao) return <View style={styles.tela} />;

  if (!permissao.granted) {
    return (
      <View style={[styles.tela, styles.centro, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { textAlign: "center", marginBottom: spacing.lg }]}>
          Precisamos da câmera para ler o QR Code da nota fiscal.
        </Text>
        <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
      </View>
    );
  }

  return (
    <View style={styles.tela}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (lido.current) return;
          lido.current = true;
          if (!chaveDoQr(data)) {
            Alert.alert("Não é uma nota fiscal", "Esse QR Code não parece ser de uma NFC-e. Aponte para o QR no rodapé do cupom.", [
              { text: "OK", onPress: () => (lido.current = false) },
            ]);
            return;
          }
          navigation.replace("NotaConsulta", { qr: data });
        }}
      />
      <View style={[styles.centro, { flex: 1 }]} pointerEvents="none">
        <View style={styles.moldura} />
        <Text style={styles.dica}>Aponte para o QR Code no rodapé do cupom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: "#000" },
  centro: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  moldura: { width: 240, height: 240, borderWidth: 2, borderColor: "#FFF", borderRadius: radius.md },
  dica: { color: "#FFF", marginTop: spacing.lg, fontSize: 15, textAlign: "center" },
});
