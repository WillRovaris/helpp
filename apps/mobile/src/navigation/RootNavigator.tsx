import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { CartaoDetalheScreen } from "../screens/CartaoDetalheScreen";
import { CartaoFormScreen } from "../screens/CartaoFormScreen";
import { CartoesScreen } from "../screens/CartoesScreen";
import { CasaSetupScreen } from "../screens/CasaSetupScreen";
import { CompartilharScreen } from "../screens/CompartilharScreen";
import { ConfiguracoesScreen } from "../screens/ConfiguracoesScreen";
import { SugestoesScreen } from "../screens/SugestoesScreen";
import { SaldoAnteriorScreen } from "../screens/SaldoAnteriorScreen";
import { ContaFormScreen } from "../screens/ContaFormScreen";
import { ContasScreen } from "../screens/ContasScreen";
import { GastoFormScreen } from "../screens/GastoFormScreen";
import { HistoricoScreen } from "../screens/HistoricoScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ImportarScreen } from "../screens/ImportarScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { PagarContaScreen } from "../screens/PagarContaScreen";
import { NotaConfirmarScreen } from "../screens/NotaConfirmarScreen";
import { NotaConsultaScreen } from "../screens/NotaConsultaScreen";
import { NotaScannerScreen } from "../screens/NotaScannerScreen";
import { EntradasScreen } from "../screens/EntradasScreen";
import { ReceitaFormScreen } from "../screens/ReceitaFormScreen";
import { useTema } from "../tema/TemaContext";
import { colors } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navegacao = createNavigationContainerRef<RootStackParamList>();

export function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { casa, loading: casaLoading } = useCasa();
  const { escuro } = useTema();

  // Tocar num lembrete abre a tela dele (contas ou cartões).
  const resposta = Notifications.useLastNotificationResponse();
  const respostaTratada = useRef<string | null>(null);
  const temCasa = !!casa;
  useEffect(() => {
    if (!resposta || !temCasa || !navegacao.isReady()) return;
    const id = resposta.notification.request.identifier;
    if (respostaTratada.current === id) return;
    respostaTratada.current = id;
    const tela = resposta.notification.request.content.data?.tela;
    if (tela === "Contas" || tela === "Cartoes") navegacao.navigate(tela);
  }, [resposta, temCasa]);
  const base = escuro ? DarkTheme : DefaultTheme;
  const temaNavegacao = {
    ...base,
    colors: { ...base.colors, primary: colors.accent, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border },
  };

  if (authLoading || (session && casaLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={temaNavegacao} ref={navegacao}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !casa ? (
          <Stack.Screen name="CasaSetup" component={CasaSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Compartilhar" component={CompartilharScreen} options={{ headerShown: true, title: "Compartilhar a casa" }} />
            <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} options={{ headerShown: true, title: "Configurações" }} />
            <Stack.Screen name="Sugestoes" component={SugestoesScreen} options={{ headerShown: true, title: "Sugestões e melhorias" }} />
            <Stack.Screen name="SaldoAnterior" component={SaldoAnteriorScreen} options={{ headerShown: true, title: "Saldo do mês anterior" }} />
            <Stack.Screen name="GastoForm" component={GastoFormScreen} options={{ headerShown: true, title: "Nova despesa" }} />
            <Stack.Screen name="Historico" component={HistoricoScreen} options={{ headerShown: true, title: "Histórico" }} />
            <Stack.Screen name="Cartoes" component={CartoesScreen} options={{ headerShown: true, title: "Cartões" }} />
            <Stack.Screen name="CartaoDetalhe" component={CartaoDetalheScreen} options={{ headerShown: true, title: "Fatura" }} />
            <Stack.Screen name="CartaoForm" component={CartaoFormScreen} options={{ headerShown: true, title: "Cartão" }} />
            <Stack.Screen name="Entradas" component={EntradasScreen} options={{ headerShown: true, title: "Entradas do mês" }} />
            <Stack.Screen name="ReceitaForm" component={ReceitaFormScreen} options={{ headerShown: true, title: "Lançar entrada" }} />
            <Stack.Screen name="Importar" component={ImportarScreen} options={{ headerShown: true, title: "Importar extrato ou fatura" }} />
            <Stack.Screen name="Contas" component={ContasScreen} options={{ headerShown: true, title: "Contas fixas" }} />
            <Stack.Screen name="ContaForm" component={ContaFormScreen} options={{ headerShown: true, title: "Conta fixa" }} />
            <Stack.Screen name="PagarConta" component={PagarContaScreen} options={{ headerShown: true, title: "Pagar conta" }} />
            <Stack.Screen name="NotaScanner" component={NotaScannerScreen} options={{ headerShown: true, title: "Ler nota fiscal" }} />
            <Stack.Screen name="NotaConsulta" component={NotaConsultaScreen} options={{ headerShown: true, title: "Consultando nota" }} />
            <Stack.Screen name="NotaConfirmar" component={NotaConfirmarScreen} options={{ headerShown: true, title: "Confirmar nota" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
