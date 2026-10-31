// Tipo de cada produto do mercado (proteínas, frutas, frios...), descoberto pelo nome que vem na nota.
// Pedido do dono: relatório do que a casa mais compra e quanto gasta em cada tipo. Sem cadastro nem
// inteligência artificial: lista de palavras, e a correção da pessoa vale para sempre (produto_grupos).
import { palavras, semPlural } from "./compras";
import { semAcento } from "./produtos";

export type GrupoId = "proteinas" | "frutas" | "verduras" | "graos" | "paes" | "bolachas" | "frios" | "laticinios" | "bebidas" | "mercearia" | "limpeza" | "higiene" | "outros";

export const GRUPOS: { id: GrupoId; nome: string; emoji: string; alimento: boolean }[] = [
  { id: "proteinas", nome: "Carnes e proteínas", emoji: "🥩", alimento: true },
  { id: "frutas", nome: "Frutas", emoji: "🍎", alimento: true },
  { id: "verduras", nome: "Verduras e legumes", emoji: "🥦", alimento: true },
  { id: "graos", nome: "Grãos e massas", emoji: "🌾", alimento: true },
  { id: "paes", nome: "Pães e bolos", emoji: "🥖", alimento: true },
  { id: "bolachas", nome: "Bolachas e doces", emoji: "🍪", alimento: true },
  { id: "frios", nome: "Frios", emoji: "🧀", alimento: true },
  { id: "laticinios", nome: "Lácteos", emoji: "🥛", alimento: true },
  { id: "bebidas", nome: "Bebidas", emoji: "🥤", alimento: true },
  { id: "mercearia", nome: "Mercearia e temperos", emoji: "🧂", alimento: true },
  { id: "limpeza", nome: "Limpeza", emoji: "🧽", alimento: false },
  { id: "higiene", nome: "Higiene", emoji: "🧴", alimento: false },
  { id: "outros", nome: "Não identificados", emoji: "❓", alimento: false },
];

// A ORDEM IMPORTA: a primeira regra que combinar vence. "DOCE DE LEITE" tem que parar nos doces antes
// de chegar nos lácteos; "MOLHO DE TOMATE" na mercearia antes das verduras; "SUCO DE LARANJA" nas
// bebidas antes das frutas. Vários termos juntos = todas as palavras. "*" no fim = começa com
// (para as abreviações da nota: "refrig*" pega REFRIG e REFRIGERANTE). Sem "*" a palavra é exata
// (ou no plural), para "maca" não pegar MACARRAO e "sal" não pegar SALGADINHO.
const REGRAS: [GrupoId, string[]][] = [
  ["higiene", ["shampoo", "xampu", "condicionador", "sabonete*", "creme dental", "cr dental", "dental", "escova dente*", "desodor*", "absorvente*", "papel hig*", "fralda*", "cotonete*", "barbeador*", "enxaguante*", "antisseptico*"]],
  ["limpeza", ["deterg*", "sabao", "lava roupa*", "amaciante*", "desinfet*", "agua sanit*", "alvejante*", "cloro", "esponja*", "papel toalha", "saco lixo", "limpador*", "limpa*", "lustra*", "multiuso*", "la aco", "inseticida*"]],
  ["mercearia", ["tempero*", "caldo*", "molho*", "maionese*", "ketchup", "catchup", "mostarda*", "sazon", "extrato*", "azeitona*", "palmito*", "vinagre*"]],
  ["bebidas", ["refrig*", "coca", "guarana", "suco*", "nectar*", "cerveja*", "cerv", "chopp", "vinho*", "vodka", "whisky", "agua", "energetico*", "isotonico*"]],
  ["bolachas", ["bolach*", "biscoit*", "wafer*", "cookie*", "chocolate*", "choc", "bombom*", "bala", "chiclete*", "doce*", "goiabada*", "brigadeiro*", "sorvete*", "picole*", "gelatina*", "pudim*", "salgadinho*", "chips", "batata palha", "batata frita", "amendoim*", "pacoca*"]],
  ["paes", ["pao", "paes", "paozinho", "bisnag*", "baguete*", "bolo", "torrada*", "rosca*", "croissant*", "cuca", "sonho"]],
  ["frios", ["queijo*", "qjo", "presunt*", "apresuntado*", "mortadela*", "salame*", "salaminho*", "mussarela*", "mucarela*", "muss", "mozzarella*", "provolone*", "parmesao", "gorgonzola*", "ricota*", "peito peru", "blanquet*"]],
  ["laticinios", ["leite*", "lte", "iogurte*", "iog", "manteiga*", "margarina*", "requeij*", "nata", "creme leite", "cr leite", "kefir", "coalhada*", "lactea*"]],
  ["proteinas", ["carne*", "bov*", "file*", "frango*", "fgo", "galinha*", "coxa*", "sobrecoxa*", "peito", "asa", "linguica*", "ling", "salsicha*", "bacon", "costela*", "patinho", "acem", "alcatra*", "contrafile*", "maminha*", "picanha*", "suino*", "pernil*", "lombo*", "bisteca*", "ovo", "peixe*", "tilapia*", "salmao", "atum", "sardinha*", "camarao", "hamburguer*", "almondega*", "nuggets"]],
  ["frutas", ["banana*", "maca", "laranja*", "limao", "mamao", "melancia*", "melao", "abacaxi*", "uva", "morango*", "pera", "pessego*", "manga", "kiwi", "abacate*", "ameixa*", "tangerina*", "bergamota*", "mexerica*", "goiaba", "maracuja*", "coco"]],
  ["verduras", ["alface*", "tomate*", "cebola", "alho", "batata*", "cenoura*", "beterraba*", "abobrinha*", "abobora*", "chuchu", "pepino*", "pimentao", "repolho*", "brocolis", "couve*", "rucula*", "agriao", "espinafre*", "mandioca*", "aipim", "inhame*", "vagem", "berinjela*", "cheiro verde", "salsinha*", "cebolinha*", "quiabo*", "moranga*"]],
  ["graos", ["arroz", "feijao", "lentilha*", "grao bico", "macarrao", "macar", "massa", "espaguete*", "lasanha*", "farinha*", "fuba", "aveia*", "granola*", "quinoa", "cuscuz", "polvilho*", "trigo", "farofa*", "canjica*", "pipoca*", "lamen", "miojo"]],
  ["mercearia", ["oleo", "azeite*", "acucar", "adocante*", "sal", "cafe", "achocol*", "cha", "fermento*", "milho", "ervilha*", "seleta*"]],
];

function termoCombina(termo: string, palavras: string[]): boolean {
  return termo.split(" ").every((t) => {
    if (t.endsWith("*")) return palavras.some((p) => p.startsWith(t.slice(0, -1)));
    return palavras.some((p) => p === t || semPlural(p) === t);
  });
}

/** Tipo do produto pelo nome da nota; o que não reconhecer fica em "outros". */
export function classificarProduto(nome: string): GrupoId {
  const lista = palavras(nome);
  for (const [grupo, termos] of REGRAS) if (termos.some((t) => termoCombina(t, lista))) return grupo;
  return "outros";
}

export interface ProdutoDoGrupo {
  chave: string;
  nome: string;
  total: number;
  vezes: number;
}

export interface ResumoGrupo {
  id: GrupoId;
  nome: string;
  emoji: string;
  alimento: boolean;
  total: number;
  produtos: ProdutoDoGrupo[]; // quem mais pesa primeiro
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Soma as compras por tipo de produto, maiores primeiro. `correcoes`: chave do produto → tipo escolhido pela pessoa. */
export function resumirPorGrupo(itens: { nome: string; valor: number }[], correcoes: Map<string, string>) {
  const grupos = new Map<GrupoId, Map<string, ProdutoDoGrupo>>();
  for (const i of itens) {
    const chave = semAcento(i.nome);
    const corrigido = correcoes.get(chave);
    const grupo = GRUPOS.some((g) => g.id === corrigido) ? (corrigido as GrupoId) : classificarProduto(i.nome);
    const produtos = grupos.get(grupo) ?? new Map<string, ProdutoDoGrupo>();
    const p = produtos.get(chave) ?? { chave, nome: i.nome.replace(/\s+/g, " ").trim(), total: 0, vezes: 0 };
    p.total = arred(p.total + i.valor);
    p.vezes += 1;
    produtos.set(chave, p);
    grupos.set(grupo, produtos);
  }
  const lista: ResumoGrupo[] = GRUPOS.filter((g) => grupos.has(g.id)).map((g) => {
    const produtos = [...grupos.get(g.id)!.values()].sort((a, b) => b.total - a.total);
    return { ...g, produtos, total: arred(produtos.reduce((s, p) => s + p.total, 0)) };
  });
  lista.sort((a, b) => b.total - a.total);
  return {
    alimentos: lista.filter((g) => g.alimento),
    outros: lista.filter((g) => !g.alimento),
    totalAlimentos: arred(lista.filter((g) => g.alimento).reduce((s, g) => s + g.total, 0)),
    total: arred(lista.reduce((s, g) => s + g.total, 0)),
  };
}
