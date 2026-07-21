// ============================================================
// tv.js — tela principal (TV / computador / projetor)
// ============================================================

import { getDataProvider } from "./data-provider.js";
import { OPTION_META } from "./questions.js";
import { runLocalTimer, renderQrCode, controllerUrl, medalFor } from "./game.js";
import { narrate, phrase, rankingComment } from "./audio.js";

const provider = getDataProvider();
const screens = {
  start: document.getElementById("screen-start"),
  lobby: document.getElementById("screen-lobby"),
  question: document.getElementById("screen-question"),
  result: document.getElementById("screen-result"),
  final: document.getElementById("screen-final"),
};

let room = null;
let players = [];
let currentQuestion = null;
let stopTimer = null;
let unsubscribe = null;

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
}

// ------------------------------------------------------------
// TELA INICIAL — criar sala
// ------------------------------------------------------------
document.getElementById("btn-create-room").addEventListener("click", async () => {
  room = await provider.createRoom();
  localStorage.setItem("bql_host_token", room.host_token || "");
  players = [];
  renderLobby();
  showScreen("lobby");

  unsubscribe = provider.subscribeRoom(room.id, handleRealtimeEvent);
});

function handleRealtimeEvent(type, payload) {
  if (type === "player_joined") {
    if (!players.find((p) => p.id === payload.id)) players.push(payload);
    renderLobby();
  } else if (type === "answer_received") {
    updateAnswerCount();
  } else if (type === "room_update" && payload.status) {
    // usado principalmente pela implementação Supabase
  }
}

// ------------------------------------------------------------
// LOBBY
// ------------------------------------------------------------
function renderLobby() {
  document.getElementById("room-code").textContent = room.code;
  document.getElementById("player-count").textContent = `${players.length} / ${room.max_players}`;
  renderQrCode(document.getElementById("qr-code"), controllerUrl(room.code));

  const list = document.getElementById("player-list");
  list.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="p-icon">${p.nickname}</span><span class="p-name">${escapeHtml(p.name)}</span>`;
    list.appendChild(li);
  });

  const full = players.length >= room.max_players;
  document.getElementById("room-full-msg").classList.toggle("hidden", !full);
  document.getElementById("min-players-msg").classList.toggle("hidden", players.length >= 2);
  document.getElementById("btn-start-game").disabled = players.length < 2;
}

document.getElementById("btn-start-game").addEventListener("click", async () => {
  const firstQuestion = await provider.startGame(room.id);
  room = await provider.getRoom(room.id);
  if (!firstQuestion) return endGame();
  await showQuestion(firstQuestion);
});

// ------------------------------------------------------------
// PERGUNTA
// ------------------------------------------------------------
async function showQuestion(question) {
  currentQuestion = question;
  document.getElementById("q-index").textContent =
    `PERGUNTA ${room.current_question_index + 1}`;
  document.getElementById("q-text").textContent = question.question;
  document.getElementById("q-bible-open-banner").classList.toggle(
    "hidden",
    question.type !== "bible_open"
  );

  const optionsEl = document.getElementById("q-options");
  optionsEl.innerHTML = "";
  ["A", "B", "C", "D"].forEach((letter) => {
    const text = question[`option_${letter.toLowerCase()}`];
    if (!text) return;
    const meta = OPTION_META[letter];
    const div = document.createElement("div");
    div.className = "option-card";
    div.style.setProperty("--color", meta.color);
    div.innerHTML = `<span class="opt-emoji">${meta.emoji}</span><span class="opt-letter">${letter}</span><span class="opt-text">${escapeHtml(text)}</span>`;
    optionsEl.appendChild(div);
  });

  document.getElementById("answer-count").textContent = `0 / ${players.length}`;
  showScreen("question");

  if (question.type === "bible_open") {
    await narrate(phrase("bibleOpen"), null);
  }
  await narrate(`${phrase("intro")} ${question.question}`, question.audio_url);

  stopTimer = runLocalTimer(
    room.question_ends_at,
    (secondsLeft) => {
      document.getElementById("timer").textContent = secondsLeft;
      document.getElementById("timer").classList.toggle("urgent", secondsLeft <= 5);
    },
    async () => {
      await narrate(phrase("timeUp"), null);
      await finishQuestion();
    }
  );
}

async function updateAnswerCount() {
  if (!currentQuestion) return;
  const answers = await provider.getAnswers(room.id, currentQuestion.id);
  document.getElementById("answer-count").textContent = `${answers.length} / ${players.length}`;
}

async function finishQuestion() {
  if (stopTimer) stopTimer();
  const { question, answers, players: updatedPlayers } = await provider.finishQuestion(room.id);
  players = updatedPlayers.sort((a, b) => b.score - a.score);

  const meta = OPTION_META[question.correct_option];
  document.getElementById("correct-emoji").textContent = meta.emoji;
  document.getElementById("correct-text").textContent =
    question[`option_${question.correct_option.toLowerCase()}`];
  document.getElementById("correct-ref").textContent = question.reference || "";
  document.getElementById("correct-explanation").textContent = question.explanation || "";

  const board = document.getElementById("scoreboard");
  board.innerHTML = "";
  players.slice(0, 6).forEach((p, i) => {
    const row = document.createElement("li");
    row.innerHTML = `<span class="medal">${medalFor(i)}</span><span class="p-icon">${p.nickname}</span><span class="p-name">${escapeHtml(p.name)}</span><span class="p-score">${p.score}</span>`;
    board.appendChild(row);
  });

  showScreen("result");
  await narrate(`${phrase("correctIntro")} ${question[`option_${question.correct_option.toLowerCase()}`]}. ${question.explanation || ""}`, null);
  await narrate(rankingComment(players), null);
}

document.getElementById("btn-next-question").addEventListener("click", async () => {
  await narrate(phrase("nextQuestion"), null);
  const next = await provider.nextQuestion(room.id);
  room = await provider.getRoom(room.id);
  if (!next) return endGame();
  await showQuestion(next);
});

// ------------------------------------------------------------
// FINAL DA PARTIDA
// ------------------------------------------------------------
async function endGame() {
  players.sort((a, b) => b.score - a.score);
  const champion = players[0];

  document.getElementById("champion-icon").textContent = champion?.nickname || "🏆";
  document.getElementById("champion-name").textContent = champion?.name || "-";
  document.getElementById("champion-score").textContent = `${champion?.score || 0} pontos`;

  const finalBoard = document.getElementById("final-scoreboard");
  finalBoard.innerHTML = "";
  players.forEach((p, i) => {
    const row = document.createElement("li");
    row.innerHTML = `<span class="medal">${medalFor(i)}</span><span class="p-icon">${p.nickname}</span><span class="p-name">${escapeHtml(p.name)}</span><span class="p-score">${p.score}</span>`;
    finalBoard.appendChild(row);
  });

  showScreen("final");
  await narrate(phrase("finalStart"), null);
  await narrate(`Parabéns, ${champion?.name || "campeão"}! Você é o grande vencedor da Bíblia Quiz Live.`, null);
}

document.getElementById("btn-new-game").addEventListener("click", () => {
  if (unsubscribe) unsubscribe();
  location.reload();
});
document.getElementById("btn-back-home").addEventListener("click", () => {
  if (unsubscribe) unsubscribe();
  location.reload();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
