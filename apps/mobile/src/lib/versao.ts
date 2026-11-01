import * as Updates from "expo-updates";

/** "1.3.0 · atualização de 24/10/2026" — versão do APK + data da atualização automática que está rodando. */
export function versaoDoApp(): string {
  const base = Updates.runtimeVersion ?? "?";
  return Updates.createdAt ? `${base} · atualização de ${Updates.createdAt.toLocaleDateString("pt-BR")}` : base;
}
