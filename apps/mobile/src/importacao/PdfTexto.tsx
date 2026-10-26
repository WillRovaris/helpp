import React, { useRef } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";

export type ResultadoPdf = { ok: true; linhas: string[] } | { ok: false; precisaSenha: boolean; erro: string };

// Extrai o texto de um PDF usando o pdf.js dentro de uma WebView escondida (o
// mesmo leitor de PDF do navegador). Cada linha da página vira uma string, na
// ordem de leitura. Precisa de internet para baixar o pdf.js na primeira vez.
const HTML = `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head><body><script>
function enviar(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
try { pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) {}
window.lerPdf = async function (b64, senha) {
  try {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var pdf = await pdfjsLib.getDocument({ data: bytes, password: senha || undefined, isEvalSupported: false }).promise;
    var linhas = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var pagina = await pdf.getPage(p);
      var conteudo = await pagina.getTextContent();
      var grupos = [];
      conteudo.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var y = it.transform[5], x = it.transform[4];
        var g = grupos.find(function (g) { return Math.abs(g.y - y) < 3; });
        if (!g) { g = { y: y, itens: [] }; grupos.push(g); }
        g.itens.push({ x: x, s: it.str });
      });
      grupos.sort(function (a, b) { return b.y - a.y; });
      grupos.forEach(function (g) {
        g.itens.sort(function (a, b) { return a.x - b.x; });
        linhas.push(g.itens.map(function (i) { return i.s; }).join(" "));
      });
    }
    enviar({ tipo: "pdf", ok: true, linhas: linhas });
  } catch (e) {
    enviar({ tipo: "pdf", ok: false, precisaSenha: !!(e && e.name === "PasswordException"), erro: String((e && e.message) || e) });
  }
};
enviar({ tipo: "pronto", temPdfjs: typeof pdfjsLib !== "undefined" });
</script></body></html>`;

export function PdfTexto({ base64, senha, onResultado }: { base64: string; senha?: string; onResultado: (r: ResultadoPdf) => void }) {
  const webview = useRef<WebView>(null);
  const enviado = useRef(false);

  return (
    <View style={{ width: 1, height: 1, opacity: 0, position: "absolute" }} pointerEvents="none">
      <WebView
        ref={webview}
        originWhitelist={["*"]}
        source={{ html: HTML, baseUrl: "https://localhost/" }}
        // Segurança: só a página interna do leitor (o PDF nunca abre links nem outras páginas).
        onShouldStartLoadWithRequest={(req) => req.url === "about:blank" || req.url.startsWith("https://localhost/")}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        onMessage={(e) => {
          let msg: { tipo: string; temPdfjs?: boolean; ok?: boolean; linhas?: string[]; precisaSenha?: boolean; erro?: string };
          try {
            msg = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (msg.tipo === "pronto") {
            if (!msg.temPdfjs) return onResultado({ ok: false, precisaSenha: false, erro: "Sem internet para abrir o leitor de PDF." });
            if (enviado.current) return;
            enviado.current = true;
            webview.current?.injectJavaScript(`window.lerPdf(${JSON.stringify(base64)}, ${JSON.stringify(senha ?? "")}); true;`);
          } else if (msg.tipo === "pdf") {
            onResultado(msg.ok ? { ok: true, linhas: msg.linhas ?? [] } : { ok: false, precisaSenha: !!msg.precisaSenha, erro: msg.erro ?? "erro" });
          }
        }}
        onError={() => onResultado({ ok: false, precisaSenha: false, erro: "Não foi possível abrir o leitor de PDF." })}
      />
    </View>
  );
}
