// Design system minimalista (seção 23 do briefing): fundo limpo, cards discretos,
// bastante espaço em branco, tipografia com boa hierarquia. Nada de aparência de
// app bancário/fiscal — parece um produto de consumo.
export const colors = {
  background: "#FAFAF9",
  surface: "#FFFFFF",
  border: "#ECECE9",
  textPrimary: "#1A1A18",
  textSecondary: "#6B6B66",
  accent: "#1F8A5B", // verde "economia", discreto
  accentContrast: "#FFFFFF",
  danger: "#C0392B",
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
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.textPrimary },
  subtitle: { fontSize: 16, fontWeight: "500" as const, color: colors.textSecondary },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.textPrimary },
  price: { fontSize: 20, fontWeight: "700" as const, color: colors.textPrimary },
  label: { fontSize: 12, fontWeight: "500" as const, color: colors.textSecondary },
};
