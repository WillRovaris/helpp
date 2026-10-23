import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { CasaProvider } from "./src/casa/CasaContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SincronizacaoProvider } from "./src/offline/SincronizacaoContext";
import { PrivacidadeProvider } from "./src/privacidade/PrivacidadeContext";
import { TemaProvider } from "./src/tema/TemaContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CasaProvider>
          <SincronizacaoProvider>
            <TemaProvider>
              <PrivacidadeProvider>
                <RootNavigator />
              </PrivacidadeProvider>
            </TemaProvider>
          </SincronizacaoProvider>
        </CasaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
