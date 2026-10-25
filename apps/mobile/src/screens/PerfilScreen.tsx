import React, { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useCasa } from "../casa/CasaContext";
import { Botao, Campo, CampoSenha, Cartao, Chip, TelaFormulario } from "../components/ui";
import { atualizar } from "../offline/repo";
import { carregarContato, mascaraTelefone, salvarContato, trocarSenha } from "../perfil/perfil";
import { type PreferenciaTema, useTema } from "../tema/TemaContext";
import { colors, spacing, typography } from "../theme";

const TEMAS: { valor: PreferenciaTema; rotulo: string }[] = [
  { valor: "sistema", rotulo: "📱 Igual ao celular" },
  { valor: "claro", rotulo: "☀️ Claro" },
  { valor: "escuro", rotulo: "🌙 Escuro" },
];

// Perfil: dados cadastrais (nome, e-mail, telefone), aparência e troca de senha.
export function PerfilScreen() {
  const { session, userId } = useAuth();
  const { meuNome } = useCasa();
  const { preferencia, escolher } = useTema();
  const email = session?.user.email ?? "";

  const [nome, setNome] = useState(meuNome ?? "");
  const [telefone, setTelefone] = useState("");
  const [aceita, setAceita] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    if (!userId) return;
    carregarContato(userId).then((c) => {
      if (!c) return;
      if (c.telefone) setTelefone(mascaraTelefone(c.telefone));
      setAceita(c.aceita_novidades);
    });
  }, [userId]);

  async function salvarDados() {
    if (!userId) return;
    const n = nome.trim();
    if (!n) return Alert.alert("Nome", "Informe seu nome.");
    const digitos = telefone.replace(/\D/g, "");
    if (digitos && digitos.length < 10) return Alert.alert("Telefone", "Digite o telefone com DDD, ex.: (48) 99999-9999.");
    setSalvando(true);
    // nome também aparece nos lançamentos da casa (grava no celular e sincroniza)
    if (n !== meuNome) atualizar("membros", userId, { nome: n });
    const erro = await salvarContato(userId, { nome: n, email, telefone: digitos || null, aceita_novidades: aceita });
    setSalvando(false);
    Alert.alert(erro ? "Não foi possível salvar" : "Pronto", erro ?? "Seus dados foram salvos.");
  }

  async function salvarSenha() {
    if (novaSenha.length < 6) return Alert.alert("Senha curta", "A senha precisa ter pelo menos 6 caracteres.");
    if (novaSenha !== confirmacao) return Alert.alert("Senhas diferentes", "A confirmação não é igual à nova senha.");
    setTrocando(true);
    const erro = await trocarSenha(novaSenha);
    setTrocando(false);
    if (erro) return Alert.alert("Não foi possível trocar a senha", erro);
    setNovaSenha("");
    setConfirmacao("");
    Alert.alert("Senha trocada", "Na próxima vez que entrar, use a nova senha.");
  }

  return (
    <TelaFormulario contentStyle={{ gap: spacing.md }}>
      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.md }]}>👤 DADOS CADASTRAIS</Text>
        <Campo rotulo="NOME" value={nome} onChangeText={setNome} placeholder="Seu nome" autoCapitalize="words" />
        <Campo rotulo="E-MAIL" value={email} editable={false} style={{ opacity: 0.6 }} />
        <Campo rotulo="TELEFONE (WHATSAPP)" value={telefone} onChangeText={(t) => setTelefone(mascaraTelefone(t))} keyboardType="phone-pad" placeholder="(48) 99999-9999" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text style={[typography.body, { flex: 1, fontSize: 14 }]}>Quero receber novidades do Helpp por e-mail ou WhatsApp</Text>
          <Switch value={aceita} onValueChange={setAceita} trackColor={{ true: colors.accent, false: colors.border }} />
        </View>
        <Botao titulo="Salvar dados" onPress={salvarDados} carregando={salvando} style={{ marginTop: spacing.md }} />
      </Cartao>

      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>🎨 APARÊNCIA</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TEMAS.map((t) => (
            <Chip key={t.valor} rotulo={t.rotulo} ativo={preferencia === t.valor} onPress={() => escolher(t.valor)} />
          ))}
        </View>
      </Cartao>

      <Cartao>
        <Text style={[typography.label, { marginBottom: spacing.md }]}>🔑 TROCAR SENHA</Text>
        <CampoSenha rotulo="NOVA SENHA" value={novaSenha} onChangeText={setNovaSenha} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
        <CampoSenha rotulo="CONFIRME A NOVA SENHA" value={confirmacao} onChangeText={setConfirmacao} placeholder="digite de novo" autoComplete="new-password" />
        {confirmacao.length > 0 && confirmacao !== novaSenha && (
          <Text style={[typography.label, { color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.sm }]}>As senhas não estão iguais.</Text>
        )}
        <Botao titulo="Trocar senha" variante="secundario" onPress={salvarSenha} carregando={trocando} />
      </Cartao>
    </TelaFormulario>
  );
}
