import type { FiscalDataProvider } from "./types.js";
import { scProvider } from "./providers/sc.provider.js";

const providers: Record<string, FiscalDataProvider> = {
  SC: scProvider,
};

export class UnsupportedStateError extends Error {
  constructor(public readonly uf: string) {
    super(`Ainda não damos suporte a notas fiscais do estado ${uf}.`);
    this.name = "UnsupportedStateError";
  }
}

export function getFiscalProvider(uf: string): FiscalDataProvider {
  const provider = providers[uf];
  if (!provider) throw new UnsupportedStateError(uf);
  return provider;
}
