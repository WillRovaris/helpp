import type { NotaLida } from "../fiscal/nfce";

export type RootStackParamList = {
  Login: undefined;
  CasaSetup: undefined;
  Home: undefined;
  Compartilhar: undefined;
  Configuracoes: undefined;
  GastoForm: { gastoId?: string };
  Historico: { categoriaId?: string };
  Entradas: { mes?: string } | undefined;
  ReceitaForm: { receitaId?: string; mes?: string };
  Importar: undefined;
  Contas: undefined;
  ContaForm: { contaId?: string };
  PagarConta: { contaId: string; competencia: string };
  NotaScanner: undefined;
  NotaConsulta: { qr: string };
  NotaConfirmar: { qr: string; nota: NotaLida };
  Cartoes: undefined;
  CartaoDetalhe: { cartaoId: string };
  CartaoForm: { cartaoId?: string };
  Sugestoes: undefined;
  SaldoAnterior: { mes: string };
  Perfil: undefined;
  Notificacoes: undefined;
  Termos: undefined;
};
