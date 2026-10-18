import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { CasaProvider } from "./src/casa/CasaContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CasaProvider>
          <RootNavigator />
        </CasaProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
