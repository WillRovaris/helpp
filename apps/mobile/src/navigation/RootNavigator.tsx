import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { CasaSetupScreen } from "../screens/CasaSetupScreen";
import { CompartilharScreen } from "../screens/CompartilharScreen";
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
