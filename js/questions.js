// ============================================================
// questions.js — constantes de alternativas + banco de perguntas
// usado pelo DemoDataProvider (mesmas perguntas do seed SQL)
// ============================================================

export const OPTION_META = {
  A: { color: "#3B82F6", label: "azul", emoji: "🟦" },
  B: { color: "#EF4444", label: "vermelho", emoji: "🟥" },
  C: { color: "#F59E0B", label: "amarelo", emoji: "🟨" },
  D: { color: "#22C55E", label: "verde", emoji: "🟩" },
};

// Ícones disponíveis para os jogadores escolherem como identidade
// visual na sala (o "nickname" É o ícone escolhido).
export const PLAYER_ICONS = [
  "🦁", "🕊️", "🔥", "⭐", "🛡️", "⚔️", "👑", "🌟", "🏹", "📖", "🐑", "⚓",
];

export const DEMO_QUESTIONS = [
  {
    id: "q1",
    question: "Quem construiu a arca?",
    option_a: "Noé", option_b: "Moisés", option_c: "Abraão", option_d: "Davi",
    correct_option: "A",
    category: "Antigo Testamento", difficulty: "easy", type: "multiple_choice",
    time_limit: 15,
    explanation: "Deus ordenou a Noé que construísse uma arca para salvar sua família e os animais do dilúvio.",
    reference: "Gênesis 6:14",
  },
  {
    id: "q2",
    question: "Quantos dias e noites choveu durante o dilúvio?",
    option_a: "7", option_b: "40", option_c: "100", option_d: "150",
    correct_option: "B",
    category: "Antigo Testamento", difficulty: "easy", type: "multiple_choice",
    time_limit: 15,
    explanation: "A chuva caiu sobre a terra durante quarenta dias e quarenta noites.",
    reference: "Gênesis 7:12",
  },
  {
    id: "q3",
    question: "Quem traiu Jesus por trinta moedas de prata?",
    option_a: "Pedro", option_b: "Tomé", option_c: "Judas Iscariotes", option_d: "João",
    correct_option: "C",
    category: "Novo Testamento", difficulty: "easy", type: "multiple_choice",
    time_limit: 15,
    explanation: "Judas Iscariotes entregou Jesus aos principais sacerdotes por trinta moedas de prata.",
    reference: "Mateus 26:15",
  },
  {
    id: "q4",
    question: '"Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito..." — de qual livro é esse versículo?',
    option_a: "Mateus", option_b: "João", option_c: "Lucas", option_d: "Marcos",
    correct_option: "B",
    category: "Novo Testamento", difficulty: "medium", type: "bible_open",
    time_limit: 30,
    explanation: "Este é um dos versículos mais conhecidos da Bíblia, sobre o amor de Deus pela humanidade.",
    reference: "João 3:16",
  },
  {
    id: "q5",
    question: "Quem foi lançado na cova dos leões?",
    option_a: "Daniel", option_b: "José", option_c: "Elias", option_d: "Jonas",
    correct_option: "A",
    category: "Antigo Testamento", difficulty: "easy", type: "multiple_choice",
    time_limit: 15,
    explanation: "Daniel foi lançado na cova dos leões por continuar orando a Deus, mas foi protegido por um anjo.",
    reference: "Daniel 6:16-22",
  },
];
