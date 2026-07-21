// ============================================================
// audio.js — narrador do jogo.
//
// Tenta reproduzir um arquivo de áudio gravado (question.audio_url).
// Se não existir ou falhar ao carregar, cai automaticamente para
// SpeechSynthesis. O jogo NUNCA trava por falta de áudio.
// ============================================================

const synth = window.speechSynthesis;
let ptVoice = null;

function pickVoice() {
  if (ptVoice || !synth) return ptVoice;
  const voices = synth.getVoices();
  ptVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("pt")) || voices[0] || null;
  return ptVoice;
}

if (synth) {
  synth.onvoiceschanged = pickVoice;
}

function speak(text) {
  return new Promise((resolve) => {
    if (!synth) return resolve();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    utter.onend = resolve;
    utter.onerror = resolve;
    synth.speak(utter);
  });
}

function playFile(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", () => resolve("fallback"));
    audio.play().catch(() => resolve("fallback"));
    // segurança: se travar por mais de 20s, libera o fluxo
    setTimeout(finish, 20000);
  });
}

/**
 * Narra um texto. Se audioUrl for informado, tenta tocar o arquivo;
 * se falhar (ou não existir), usa a síntese de voz automaticamente.
 */
export async function narrate(text, audioUrl) {
  if (audioUrl) {
    const result = await playFile(audioUrl);
    if (result !== "fallback") return;
  }
  await speak(text);
}

// ------------------------------------------------------------
// Bancos de frases variadas por momento do jogo (evita repetição)
// ------------------------------------------------------------
const PHRASES = {
  intro: [
    "Preparem-se, a pergunta está chegando!",
    "Atenção, jogadores! Aqui vai a próxima pergunta.",
    "Vamos testar o que vocês sabem sobre as Escrituras.",
  ],
  timeUp: [
    "Tempo esgotado!",
    "O tempo acabou, vamos ver as respostas.",
    "Acabou o tempo! Confira se você acertou.",
  ],
  correctIntro: [
    "A resposta correta é:",
    "A resposta certa era:",
    "Vejam só, a alternativa correta é:",
  ],
  nextQuestion: [
    "Preparem-se para a próxima pergunta.",
    "Vamos em frente, próxima pergunta chegando.",
    "Aqui vem mais uma pergunta para vocês.",
  ],
  bibleOpen: [
    "Peguem suas Bíblias! Vocês podem consultar para responder.",
    "Rodada Bíblia Aberta! Procurem o versículo e respondam.",
  ],
  finalStart: [
    "Chegamos à grande final!",
    "É hora de conhecer o campeão da partida!",
  ],
};

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function phrase(kind) {
  return randomOf(PHRASES[kind] || [""]);
}

/**
 * Comenta uma mudança de posição no ranking (usado após cada pergunta).
 */
export function rankingComment(players) {
  if (!players || players.length === 0) return "";
  const leader = players[0];
  const templates = [
    `${leader.name} continua na liderança.`,
    `${leader.name} assume o primeiro lugar!`,
    `${leader.name} está na frente de todos.`,
  ];
  return randomOf(templates);
}
