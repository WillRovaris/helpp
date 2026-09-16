import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Em produção (app publicado / testado externamente), aponta pra API na Vercel
// via EXPO_PUBLIC_API_URL (definido em apps/mobile/.env). Sem essa variável,
// cai no fallback de desenvolvimento local:
// - Android emulator não enxerga "localhost" do host — usa o alias 10.0.2.2.
// - iOS simulator e web funcionam com localhost normalmente.
// - Em device físico sem EXPO_PUBLIC_API_URL, troque pelo IP da máquina na rede.
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:3333`;

const TOKEN_KEY = "@helpp/token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? "Erro inesperado.", response.status);
  }
  return body as T;
}
