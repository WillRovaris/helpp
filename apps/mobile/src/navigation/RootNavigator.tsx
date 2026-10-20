import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { CartaoFormScreen } from "../screens/CartaoFormScreen";
import { CartoesScreen } from "../screens/CartoesScreen";
import { CasaSetupScreen } from "../screens/CasaSetupScreen";
import { CompartilharScreen } from "../screens/CompartilharScreen";
import { ConfiguracoesScreen } from "../screens/ConfiguracoesScreen";
import { GastoFormScreen } from "../screens/GastoFormScreen";
import { HistoricoScreen } from "../screens/HistoricoScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { NotaConfirmarScreen } from "../screens/NotaConfirmarScreen";
import { NotaConsultaScreen } from "../screens/NotaConsultaScreen";
import { NotaScannerScreen } from "../screens/NotaScannerScreen";
import { RendaScreen } from "../screens/RendaScreen";
import { useTema } from "../tema/TemaContext";
import { colors } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { casa, loading: casaLoading } = useCasa();
  const { escuro } = useTema();
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
    <NavigationContainer theme={temaNavegacao}>
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
            <Stack.Screen name="GastoForm" component={GastoFormScreen} options={{ headerShown: true, title: "Novo gasto" }} />
            <Stack.Screen name="Historico" component={HistoricoScreen} options={{ headerShown: true, title: "Gastos" }} />
            <Stack.Screen name="Cartoes" component={CartoesScreen} options={{ headerShown: true, title: "Cartões" }} />
            <Stack.Screen name="CartaoForm" component={CartaoFormScreen} options={{ headerShown: true, title: "Cartão" }} />
            <Stack.Screen name="Renda" component={RendaScreen} options={{ headerShown: true, title: "Renda do mês" }} />
            <Stack.Screen name="NotaScanner" component={NotaScannerScreen} options={{ headerShown: true, title: "Ler nota fiscal" }} />
            <Stack.Screen name="NotaConsulta" component={NotaConsultaScreen} options={{ headerShown: true, title: "Consultando nota" }} />
            <Stack.Screen name="NotaConfirmar" component={NotaConfirmarScreen} options={{ headerShown: true, title: "Confirmar nota" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
