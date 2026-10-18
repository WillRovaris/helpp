import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { CartaoFormScreen } from "../screens/CartaoFormScreen";
import { CartoesScreen } from "../screens/CartoesScreen";
import { CasaSetupScreen } from "../screens/CasaSetupScreen";
import { CompartilharScreen } from "../screens/CompartilharScreen";
import { GastoFormScreen } from "../screens/GastoFormScreen";
import { HistoricoScreen } from "../screens/HistoricoScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { colors } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const { casa, loading: casaLoading } = useCasa();

  if (authLoading || (session && casaLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : !casa ? (
          <Stack.Screen name="CasaSetup" component={CasaSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Compartilhar" component={CompartilharScreen} options={{ headerShown: true, title: "Compartilhar a casa" }} />
            <Stack.Screen name="GastoForm" component={GastoFormScreen} options={{ headerShown: true, title: "Novo gasto" }} />
            <Stack.Screen name="Historico" component={HistoricoScreen} options={{ headerShown: true, title: "Gastos" }} />
            <Stack.Screen name="Cartoes" component={CartoesScreen} options={{ headerShown: true, title: "Cartões" }} />
            <Stack.Screen name="CartaoForm" component={CartaoFormScreen} options={{ headerShown: true, title: "Cartão" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
