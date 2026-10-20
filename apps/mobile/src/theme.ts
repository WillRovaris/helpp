// Design minimalista: fundo limpo, cards discretos, bastante espaço em branco.
// Dois temas (claro e escuro). `colors` e `typography` leem a paleta ATUAL a cada
// render (getters), então trocar o tema e redesenhar o app basta — ver TemaProvider.

export type Paleta = {
  background: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentContrast: string;
  danger: string;
  warning: string;
};

export const PALETA_CLARA: Paleta = {
  background: "#FAFAF9",
  surface: "#FFFFFF",
  border: "#ECECE9",
  textPrimary: "#1A1A18",
  textSecondary: "#6B6B66",
  accent: "#1F8A5B", // verde "economia", discreto
  accentContrast: "#FFFFFF",
  danger: "#C0392B",
  warning: "#D97706",
};

export const PALETA_ESCURA: Paleta = {
  background: "#121212",
  surface: "#1E1E1E",
  border: "#2E2E2E",
  textPrimary: "#F2F2EF",
  textSecondary: "#A3A39E",
  accent: "#34B37A",
  accentContrast: "#FFFFFF",
  danger: "#EF5350",
  warning: "#F59E0B",
};

let atual: Paleta = PALETA_CLARA;

/** Chamado só pelo TemaProvider. */
export function aplicarPaleta(p: Paleta) {
  atual = p;
}

export function temaEscuroAtivo(): boolean {
  return atual === PALETA_ESCURA;
}

export const colors: Paleta = {
  get background() { return atual.background; },
  get surface() { return atual.surface; },
  get border() { return atual.border; },
  get textPrimary() { return atual.textPrimary; },
  get textSecondary() { return atual.textSecondary; },
  get accent() { return atual.accent; },
  get accentContrast() { return atual.accentContrast; },
  get danger() { return atual.danger; },
  get warning() { return atual.warning; },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
};

export const typography = {
  get title() { return { fontSize: 28, fontWeight: "700" as const, color: atual.textPrimary }; },
  get subtitle() { return { fontSize: 16, fontWeight: "500" as const, color: atual.textSecondary }; },
  get body() { return { fontSize: 15, fontWeight: "400" as const, color: atual.textPrimary }; },
  get price() { return { fontSize: 20, fontWeight: "700" as const, color: atual.textPrimary }; },
  get label() { return { fontSize: 12, fontWeight: "500" as const, color: atual.textSecondary }; },
};
