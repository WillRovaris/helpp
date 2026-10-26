// Leitura da NFC-e direto no celular. A página de consulta da SEFAZ abre numa
// WebView (navegador de verdade: cookies, JS, captcha resolvido pela pessoa) e
// o script abaixo roda DENTRO dela, lendo os dados pelos seletores da página.
// Mesmos seletores do parser antigo da API (apps/api/src/fiscal/providers/
// sc.provider.ts), validados com uma nota real de SC em 15/09/2026.

export interface NotaLida {
  estabelecimento: string;
  cnpj: string;
  endereco: string;
  total: number;
  /** "YYYY-MM-DDTHH:mm:ss" no horário local, ou null se não achou. */
  dataCompra: string | null;
  itens: { nome: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
}

export type MensagemExtracao = { tipo: "nota"; ok: true; nota: NotaLida } | { tipo: "nota"; ok: false; motivo: string };

/** URL da consulta a partir do conteúdo do QR (normalmente já é a URL completa). */
export function urlConsulta(qr: string): string {
  const t = qr.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `http://sat.sef.sc.gov.br/nfce/consulta?p=${t}`;
}

/** Endereço "http(s)://site.gov.br/..." é de órgão público (SEFAZ)? Segurança: QR falso não abre página qualquer dentro do app. */
export function ehEnderecoDoGoverno(url: string): boolean {
  const m = url.trim().match(/^https?:\/\/([^/?#:@\s]+)(:\d+)?([/?#]|$)/i);
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host === "gov.br" || host.endsWith(".gov.br");
}

/** Endereço da consulta, ou null se o QR não for de nota fiscal (não aponta para site do governo). */
export function urlConsultaSegura(qr: string): string | null {
  const url = urlConsulta(qr);
  return ehEnderecoDoGoverno(url) ? url : null;
}

/** Chave de acesso (44 dígitos) embutida no QR, ou null se não for QR de nota. */
export function chaveDoQr(qr: string): string | null {
  const m = qr.match(/\d{44}/);
  return m ? m[0] : null;
}

// ES5 de propósito: roda no navegador da WebView.
export const SCRIPT_EXTRAIR_NOTA = `
(function () {
  function enviar(msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function texto(el) { return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : ""; }
  function numero(t) {
    if (!t) return null;
    var s = t.trim().replace(/^R\\$\\s*/i, "");
    if (/[A-Za-zÀ-ÿ]/.test(s)) return null;
    s = s.replace(/[^\\d.,-]/g, "");
    if (!s) return null;
    var n = Number(s.indexOf(",") >= 0 ? s.replace(/\\./g, "").replace(",", ".") : s);
    return isFinite(n) ? n : null;
  }
  try {
    var linhas = document.querySelectorAll("#tabResult tr[id^='Item']");
    var itens = [];
    for (var i = 0; i < linhas.length; i++) {
      var tds = linhas[i].querySelectorAll("td");
      if (!tds.length) continue;
      var c = tds[0];
      var nome = texto(c.querySelector(".txtTit"));
      if (!nome) continue;
      var qtd = numero(texto(c.querySelector(".Rqtd")).replace(/Qtde\\.?:?/i, "")) || 1;
      var vu = numero(texto(c.querySelector(".RvlUnit")).replace(/Vl\\.?\\s*Unit\\.?:?/i, "")) || 0;
      var vt = tds[1] ? numero(texto(tds[1].querySelector(".valor"))) : null;
      itens.push({ nome: nome, quantidade: qtd, valorUnitario: vu, valorTotal: vt != null ? vt : Math.round(vu * qtd * 100) / 100 });
    }
    if (!itens.length) { enviar({ tipo: "nota", ok: false, motivo: "sem-itens" }); return; }

    var cab = document.querySelector(".txtCenter");
    var estabelecimento = cab ? texto(cab.querySelector(".txtTopo")) : "";
    var blocos = cab ? cab.querySelectorAll(".text") : [];
    var cnpjM = blocos.length ? texto(blocos[0]).match(/[\\d.\\/-]{14,18}/) : null;
    var endereco = blocos.length > 1 ? texto(blocos[1]) : "";

    var total = null;
    var totais = document.querySelectorAll("#linhaTotal");
    for (var j = 0; j < totais.length; j++) {
      if (/valor a pagar/i.test(texto(totais[j].querySelector("label")))) total = numero(texto(totais[j].querySelector(".totalNumb")));
    }
    if (total == null) {
      total = 0;
      for (var k = 0; k < itens.length; k++) total += itens[k].valorTotal;
      total = Math.round(total * 100) / 100;
    }

    var corpo = document.body ? document.body.innerText || document.body.textContent : "";
    var d = corpo.match(/(\\d{2})\\/(\\d{2})\\/(\\d{4})\\D{0,10}(\\d{2}):(\\d{2}):(\\d{2})/);
    var dataCompra = d ? d[3] + "-" + d[2] + "-" + d[1] + "T" + d[4] + ":" + d[5] + ":" + d[6] : null;

    enviar({ tipo: "nota", ok: true, nota: {
      estabelecimento: estabelecimento || "Estabelecimento",
      cnpj: cnpjM ? cnpjM[0].replace(/\\D/g, "") : "",
      endereco: endereco,
      total: total,
      dataCompra: dataCompra,
      itens: itens
    } });
  } catch (e) {
    enviar({ tipo: "nota", ok: false, motivo: String(e) });
  }
})();
true;
`;
