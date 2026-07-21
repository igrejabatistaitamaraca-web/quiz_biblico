// ============================================================
// controle.js — tela do celular (controle do jogador)
// ============================================================

import { getDataProvider } from "./data-provider.js";
import { OPTION_META, PLAYER_ICONS } from "./questions.js";
import { ROOM_STATUS } from "./game.js";

const provider = getDataProvider();
const screens = {
  join: document.getElementById("screen-join"),
  waiting: document.getElementById("screen-waiting"),
  question: document.getElementById("screen-question"),
  submitted: document.getElementById("screen-submitted"),
  result: document.getElementById("screen-result"),
  final: document.getElementById("screen-final"),
  error: document.getElementById("screen-error"),
};

let room = null;
let player = null;
let selectedIcon = null;
let currentQuestion = null;
let answeredQuestionIds = new Set();

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
}

function showError(message) {
  document.getElementById("error-message").textContent = message;
  showScreen("error");
}

// ------------------------------------------------------------
// ENTRADA NA SALA
// ------------------------------------------------------------
const params = new URLSearchParams(location.search);
const codeFromUrl = params.get("room");
if (codeFromUrl) {
  document.getElementById("input-room-code").value = codeFromUrl.toUpperCase();
}

renderIconPicker();

function renderIconPicker() {
  const grid = document.getElementById("icon-grid");
  grid.innerHTML = "";
  PLAYER_ICONS.forEach((icon) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-option";
    btn.textContent = icon;
    btn.addEventListener("click", () => {
      selectedIcon = icon;
      grid.querySelectorAll(".icon-option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      updateJoinButtonState();
    });
    grid.appendChild(btn);
  });
}

const nameInput = document.getElementById("input-name");
nameInput.addEventListener("input", updateJoinButtonState);

function updateJoinButtonState() {
  const ok = nameInput.value.trim().length > 0 && selectedIcon !== null;
  document.getElementById("btn-join").disabled = !ok;
}

document.getElementById("btn-join").addEventListener("click", async () => {
  const code = document.getElementById("input-room-code").value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!code || !name || !selectedIcon) return;

  try {
    const foundRoom = await provider.getRoomByCode(code);
    if (!foundRoom) return showError("Sala não encontrada. Confira o código e tente novamente.");
    if (foundRoom.status !== ROOM_STATUS.WAITING) {
      return showError("Esta partida já começou. Peça ao anfitrião para criar uma nova sala.");
    }

    room = foundRoom;
    player = await provider.joinPlayer(room.id, name, selectedIcon);

    localStorage.setItem("bql_player_id", player.id);
    localStorage.setItem("bql_room_code", room.code);

    document.getElementById("summary-name").textContent = player.name;
    document.getElementById("summary-icon").textContent = player.nickname;
    showScreen("waiting");
    await refreshWaitingCount();

    provider.subscribeRoom(room.id, handleRealtimeEvent);
  } catch (err) {
    if (err.message === "SALA_CHEIA") {
      showError("SALA CHEIA — Máximo de 6 jogadores atingido.");
    } else {
      showError(err.message || "Não foi possível entrar na sala.");
    }
  }
});

// ------------------------------------------------------------
// EVENTOS EM TEMPO REAL
// ------------------------------------------------------------
function handleRealtimeEvent(type, payload) {
  if (type === "new_question") {
    answeredQuestionIds = new Set(); // nova pergunta, libera resposta
    showQuestion(payload.question);
  } else if (type === "player_joined") {
    refreshWaitingCount();
  } else if (type === "question_finished") {
    showQuestionResult(payload);
  } else if (type === "game_finished") {
    showScreen("final");
  } else if (type === "room_update") {
    if (payload.status === ROOM_STATUS.FINISHED) showScreen("final");
  }
}

// ------------------------------------------------------------
// PERGUNTA
// ------------------------------------------------------------
function showQuestion(question) {
  currentQuestion = question;
  document.getElementById("c-q-text").textContent = question.question;

  const grid = document.getElementById("answer-grid");
  grid.innerHTML = "";
  ["A", "B", "C", "D"].forEach((letter) => {
    const text = question[`option_${letter.toLowerCase()}`];
    if (!text) return;
    const meta = OPTION_META[letter];
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.style.setProperty("--color", meta.color);
    btn.innerHTML = `<span class="letter">${letter}</span><span class="text">${escapeHtml(text)}</span>`;
    btn.addEventListener("click", () => submitAnswer(letter));
    grid.appendChild(btn);
  });

  document.getElementById("answer-grid").querySelectorAll("button").forEach((b) => (b.disabled = false));
  showScreen("question");
}

async function refreshWaitingCount() {
  if (!room) return;
  const players = await provider.listPlayers(room.id);
  const count = players.length;
  document.getElementById("waiting-count").textContent = `${count} / ${room.max_players} jogadores`;
  document.getElementById("waiting-min-msg").classList.toggle("hidden", count >= 2);
  document.getElementById("waiting-host-msg").classList.toggle("hidden", count < 2);
}

function showQuestionResult({ question, answers, players }) {
  const mine = answers.find((a) => a.player_id === player?.id);
  const correct = mine && mine.answer === question.correct_option;
  const box = document.getElementById("result-feedback");
  box.textContent = correct ? "✅ Você acertou!" : mine ? "❌ Você errou." : "⏱️ Você não respondeu a tempo.";
  box.className = correct ? "feedback correct" : "feedback wrong";
  document.getElementById("result-points").textContent = mine ? `+${mine.points} pontos` : "";

  const me = players.find((p) => p.id === player?.id);
  const rank = [...players].sort((a, b) => b.score - a.score);
  const position = rank.findIndex((p) => p.id === player?.id) + 1;
  document.getElementById("result-position").textContent = me
    ? `${position}º lugar — ${me.score} pontos no total`
    : "";

  showScreen("result");
}

async function submitAnswer(letter) {
  if (answeredQuestionIds.has(currentQuestion.id)) return;
  answeredQuestionIds.add(currentQuestion.id);

  document.querySelectorAll("#answer-grid button").forEach((b) => (b.disabled = true));

  try {
    await provider.submitAnswer(room.id, currentQuestion.id, player.id, letter);
    showScreen("submitted");
  } catch (err) {
    // já respondida (constraint única) ou erro de rede — mantém bloqueado
    showScreen("submitted");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
