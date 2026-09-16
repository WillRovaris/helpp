// Estrutura da chave de acesso de 44 dígitos (padrão nacional NF-e/NFC-e):
// cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
const UF_BY_CODE: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

export interface AccessKeyInfo {
  accessKey: string;
  uf: string;
  issueYear: number;
  issueMonth: number;
  cnpj: string;
  model: string;
  series: string;
  number: string;
}

export function parseAccessKey(rawKey: string): AccessKeyInfo {
  const key = rawKey.replace(/\D/g, "");
  if (key.length !== 44) {
    throw new Error(`Chave de acesso inválida: esperado 44 dígitos, recebido ${key.length}`);
  }

  const ufCode = key.slice(0, 2);
  const uf = UF_BY_CODE[ufCode];
  if (!uf) {
    throw new Error(`Código de UF desconhecido na chave de acesso: ${ufCode}`);
  }

  return {
    accessKey: key,
    uf,
    issueYear: 2000 + Number(key.slice(2, 4)),
    issueMonth: Number(key.slice(4, 6)),
    cnpj: key.slice(6, 20),
    model: key.slice(20, 22),
    series: key.slice(22, 25),
    number: key.slice(25, 34),
  };
}

/**
 * O conteúdo lido da câmera pode ser a URL completa do QR (com a chave embutida
 * no parâmetro `p`) ou, em alguns leitores, só a string de parâmetros. Extraímos
 * a chave de 44 dígitos de onde ela estiver.
 */
export function extractAccessKeyFromQr(qrContent: string): string {
  const match = qrContent.match(/\d{44}/);
  if (!match) {
    throw new Error("Não foi possível encontrar uma chave de acesso de 44 dígitos no QR Code.");
  }
  return match[0];
}
