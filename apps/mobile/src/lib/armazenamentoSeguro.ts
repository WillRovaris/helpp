// Onde o login fica guardado no celular (auditoria de segurança, 26/10): no cofre do Android
// (expo-secure-store, criptografado pelo sistema) em vez do AsyncStorage comum.
// O cofre aceita valores pequenos (~2 KB), então o login é guardado em pedaços.
// Quem já estava logado continua logado: na primeira leitura o login sai do AsyncStorage e vai para o cofre.
// Se o cofre falhar em algum celular, usa o AsyncStorage como antes (melhor do que deslogar a pessoa).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const PEDACO = 1800;
/** O cofre só aceita letras, números, ".", "-" e "_" no nome. */
const nome = (chave: string) => chave.replace(/[^A-Za-z0-9._-]/g, "_");

async function lerDoCofre(chave: string): Promise<string | null> {
  const qtd = Number(await SecureStore.getItemAsync(`${nome(chave)}.n`));
  if (!qtd) return null;
  const partes: string[] = [];
  for (let i = 0; i < qtd; i++) {
    const p = await SecureStore.getItemAsync(`${nome(chave)}.${i}`);
    if (p == null) return null;
    partes.push(p);
  }
  return partes.join("");
}

async function gravarNoCofre(chave: string, valor: string) {
  const antes = Number(await SecureStore.getItemAsync(`${nome(chave)}.n`)) || 0;
  const qtd = Math.max(1, Math.ceil(valor.length / PEDACO));
  for (let i = 0; i < qtd; i++) await SecureStore.setItemAsync(`${nome(chave)}.${i}`, valor.slice(i * PEDACO, (i + 1) * PEDACO));
  await SecureStore.setItemAsync(`${nome(chave)}.n`, String(qtd));
  for (let i = qtd; i < antes; i++) await SecureStore.deleteItemAsync(`${nome(chave)}.${i}`);
}

async function apagarDoCofre(chave: string) {
  const qtd = Number(await SecureStore.getItemAsync(`${nome(chave)}.n`)) || 0;
  await SecureStore.deleteItemAsync(`${nome(chave)}.n`);
  for (let i = 0; i < qtd; i++) await SecureStore.deleteItemAsync(`${nome(chave)}.${i}`);
}

export const armazenamentoSeguro = {
  async getItem(chave: string): Promise<string | null> {
    try {
      const doCofre = await lerDoCofre(chave);
      if (doCofre != null) return doCofre;
      const antigo = await AsyncStorage.getItem(chave);
      if (antigo != null) {
        await gravarNoCofre(chave, antigo);
        await AsyncStorage.removeItem(chave);
      }
      return antigo;
    } catch {
      return AsyncStorage.getItem(chave);
    }
  },
  async setItem(chave: string, valor: string): Promise<void> {
    try {
      await gravarNoCofre(chave, valor);
      await AsyncStorage.removeItem(chave);
    } catch {
      await AsyncStorage.setItem(chave, valor);
      // Não deixa no cofre um login mais velho que o da cópia comum.
      await apagarDoCofre(chave).catch(() => {});
    }
  },
  async removeItem(chave: string): Promise<void> {
    try {
      await apagarDoCofre(chave);
    } catch {
      // segue: apaga também a cópia comum
    }
    await AsyncStorage.removeItem(chave);
  },
};
