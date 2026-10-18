import type { NotaLida } from "../fiscal/nfce";

export type RootStackParamList = {
  Login: undefined;
  CasaSetup: undefined;
  Home: undefined;
  Compartilhar: undefined;
  GastoForm: { gastoId?: string };
  Historico: { categoriaId?: string };
  Renda: undefined;
  NotaScanner: undefined;
  NotaConsulta: { qr: string };
  NotaConfirmar: { qr: string; nota: NotaLida };
  Cartoes: undefined;
  CartaoForm: { cartaoId?: string };
};
