export interface ImportedReceipt {
  receipt: { id: string; purchaseDate: string; totalValue: number };
  establishment: { id: string; legalName: string; tradeName: string | null; city: string | null };
  items: { id: string; rawDescription: string; name: string; quantity: number; totalPrice: number; identified: boolean }[];
}

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Scanner: undefined;
  FiscalWebView: { qrContent: string };
  Confirmation: { result: ImportedReceipt };
  Search: undefined;
  ProductDetail: { productId: string; name: string };
};
