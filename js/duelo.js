import { getDataProvider } from "./data-provider.js";
import { OPTION_META, PLAYER_ICONS } from "./questions.js";
import { ROOM_STATUS, runLocalTimer, medalFor, renderQrCode } from "./game.js";

const provider = getDataProvider();
const screens = Object.fromEntries(
  ["home", "lobby", "question", "result", "final", "error"].map((name) => [
    name,
    document.getElementById(`screen-${name}`),
  ])
);

let room = null;
let player = null;
let players = [];
let currentQuestion = null;
let selectedIcon = null;
let isHost = false;
let unsubscribe = null;
let stopTimer = null;
let finishing = false;

const urlCode = new URLSearchParams(location.search).get("room")?.toUpperCase() || "";
document.getElementById("room-code-input").value = urlCode;
renderIcons();
restoreSession();

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
}

function renderIcons() {
  const picker = document.getElementById("icon-picker");
  PLAYER_ICONS.forEach((icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon";
    button.textContent = icon;
    button.addEventListener("click", () => {
      selectedIcon = icon;
      picker.querySelectorAll(".icon").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
    picker.appendChild(button);
  });
}

function formData() {
  return {
    name: document.getElementById("player-name").value.trim(),
    code: document.getElementById("room-code-input").value.trim().toUpperCase(),
  };
}

function validateIdentity() {
  const { name } = formData();
  if (!name) throw new Error("Digite seu nome.");
  if (!selectedIcon) throw new Error("Escolha um ícone.");
  return name;
}

document.getElementById("btn-create").addEventListener("click", async () => {
  try {
    setHomeBusy(true);
    const name = validateIdentity();
    room = await provider.createRoom();
    localStorage.setItem(`bql_online_host_${room.id}`, room.host_token || "demo-host");
    player = await provider.joinPlayer(room.id, name, selectedIcon);
    isHost = true;
    history.replaceState(null, "", inviteUrl(room.code));
    saveSession();
    await connectRoom();
  } catch (error) {
    showHomeError(error);
  } finally {
    setHomeBusy(false);
  }
});

document.getElementById("btn-join").addEventListener("click", async () => {
  try {
    setHomeBusy(true);
    const name = validateIdentity();
    const { code } = formData();
    if (!code) throw new Error("Digite o código da sala.");
    room = await provider.getRoomByCode(code);
    if (!room) throw new Error("Sala não encontrada.");
    if (room.status !== ROOM_STATUS.WAITING) throw new Error("Essa partida já começou.");
    player = await provider.joinPlayer(room.id, name, selectedIcon);
    isHost = false;
    saveSession();
    await connectRoom();
  } catch (error) {
    showHomeError(error);
  } finally {
    setHomeBusy(false);
  }
});

async function restoreSession() {
  if (!urlCode) return;
  const saved = JSON.parse(localStorage.getItem(`bql_online_session_${urlCode}`) || "null");
  if (!saved?.playerId) return;
  try {
    const [savedRoom, savedPlayer] = await Promise.all([
      provider.getRoomByCode(urlCode),
      provider.getPlayer(saved.playerId),
    ]);
    if (!savedRoom || !savedPlayer || savedPlayer.room_id !== savedRoom.id) return;
    room = savedRoom;
    player = savedPlayer;
    const hostToken = localStorage.getItem(`bql_online_host_${room.id}`);
    isHost = Boolean(hostToken && hostToken === (room.host_token || "demo-host"));
    await connectRoom();
  } catch (error) {
    console.warn("Não foi possível restaurar a sessão online.", error);
  }
}

async function connectRoom() {
  if (unsubscribe) unsubscribe();
  unsubscribe = provider.subscribeRoom(room.id, handleEvent);
  await refreshPlayers();
  await syncRoomState(await provider.getRoom(room.id));
}

async function handleEvent(type, payload) {
  try {
    if (type === "subscribed" || type === "player_joined") {
      await refreshPlayers();
      if (room.status === ROOM_STATUS.WAITING) renderLobby();
    } else if (type === "answer_received") {
      await refreshAnswerCount();
    } else if (type === "room_update") {
      await syncRoomState(payload);
    } else if (type === "new_question") {
      room = payload.room;
      await showQuestion(payload.question);
    } else if (type === "question_finished") {
      await showResult(payload);
    } else if (type === "game_finished") {
      await showFinal();
    }
  } catch (error) {
    showFatal(error);
  }
}

async function syncRoomState(updatedRoom) {
  if (!updatedRoom) return;
  room = updatedRoom;
  saveSession();
  if (room.status === ROOM_STATUS.WAITING || room.status === ROOM_STATUS.PLAYING) {
    await refreshPlayers();
    renderLobby();
    return;
  }
  if (room.status === ROOM_STATUS.QUESTION_ACTIVE && room.current_question_id) {
    if (currentQuestion?.id !== room.current_question_id) {
      const question = await provider.getQuestion(room.current_question_id);
      await showQuestion(question);
    }
    return;
  }
  if (room.status === ROOM_STATUS.SHOWING_RESULT && room.current_question_id) {
    await showResult(await provider.getQuestionResult(room.id, room.current_question_id));
    return;
  }
  if (room.status === ROOM_STATUS.FINISHED) await showFinal();
}

function renderLobby() {
  showScreen("lobby");
  document.getElementById("room-code").textContent = room.code;
  const url = inviteUrl(room.code);
  document.getElementById("invite-link").textContent = url;
  renderQrCode(document.getElementById("invite-qr"), url);
  document.getElementById("lobby-message").textContent =
    players.length < 2 ? "Aguardando pelo menos mais um jogador..." : `${players.length} jogadores prontos`;
  const list = document.getElementById("player-list");
  list.innerHTML = "";
  players.forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `<span>${item.nickname}</span><span class="name">${escapeHtml(item.name)}</span>${item.id === player.id && isHost ? '<span class="host">ANFITRIÃO</span>' : ""}`;
    list.appendChild(row);
  });
  const start = document.getElementById("btn-start");
  start.classList.toggle("hidden", !isHost);
  start.disabled = players.length < 2 || players.length > 6;
}

document.getElementById("btn-share").addEventListener("click", async () => {
  const url = inviteUrl(room.code);
  const data = { title: "Bíblia Quiz Online", text: `Entre na minha sala ${room.code}`, url };
  if (navigator.share) await navigator.share(data);
  else {
    await navigator.clipboard.writeText(url);
    document.getElementById("btn-share").textContent = "Link copiado!";
  }
});

document.getElementById("btn-start").addEventListener("click", async () => {
  if (!isHost || players.length < 2) return;
  try {
    const question = await provider.startGame(room.id);
    room = await provider.getRoom(room.id);
    if (question) await showQuestion(question);
    else await showFinal();
  } catch (error) {
    showFatal(error);
  }
});

async function showQuestion(question) {
  if (!question) return;
  if (stopTimer) stopTimer();
  finishing = false;
  currentQuestion = question;
  showScreen("question");
  document.getElementById("question-index").textContent = `Pergunta ${room.current_question_index + 1}`;
  document.getElementById("question-text").textContent = question.question;
  const answers = await provider.getAnswers(room.id, question.id);
  const mine = answers.find((answer) => answer.player_id === player.id);
  const grid = document.getElementById("answer-grid");
  grid.innerHTML = "";
  ["A", "B", "C", "D"].forEach((letter) => {
    const text = question[`option_${letter.toLowerCase()}`];
    if (!text) return;
    const button = document.createElement("button");
    button.className = "answer";
    button.style.background = OPTION_META[letter].color;
    button.innerHTML = `<strong>${letter}</strong>${escapeHtml(text)}`;
    button.disabled = Boolean(mine);
    button.addEventListener("click", () => submitAnswer(letter));
    grid.appendChild(button);
  });
  document.getElementById("answer-status").textContent = mine
    ? `Resposta enviada • ${answers.length}/${players.length}`
    : `${answers.length}/${players.length} responderam`;
  stopTimer = runLocalTimer(
    room.question_ends_at,
    (seconds) => {
      const timer = document.getElementById("timer");
      timer.textContent = seconds;
      timer.classList.toggle("urgent", seconds <= 5);
    },
    () => { if (isHost) finishRound(); }
  );
}

async function submitAnswer(letter) {
  document.querySelectorAll(".answer").forEach((button) => { button.disabled = true; });
  try {
    await provider.submitAnswer(room.id, currentQuestion.id, player.id, letter);
    document.getElementById("answer-status").textContent = "Resposta enviada! Aguardando os demais...";
  } catch (error) {
    document.getElementById("answer-status").textContent = error.message || "A resposta não foi enviada.";
  }
}

async function refreshAnswerCount() {
  if (!currentQuestion || room.status !== ROOM_STATUS.QUESTION_ACTIVE) return;
  const answers = await provider.getAnswers(room.id, currentQuestion.id);
  document.getElementById("answer-status").textContent = `${answers.length}/${players.length} responderam`;
  if (isHost && players.length >= 2 && answers.length >= players.length) await finishRound();
}

async function finishRound() {
  if (!isHost || finishing) return;
  finishing = true;
  if (stopTimer) stopTimer();
  try {
    const latest = await provider.getRoom(room.id);
    if (latest.status !== ROOM_STATUS.QUESTION_ACTIVE) return;
    await showResult(await provider.finishQuestion(room.id));
  } catch (error) {
    finishing = false;
    showFatal(error);
  }
}

async function showResult(result) {
  if (!result?.question) return;
  if (stopTimer) stopTimer();
  currentQuestion = result.question;
  players = [...result.players].sort((a, b) => b.score - a.score);
  const mine = result.answers.find((answer) => answer.player_id === player.id);
  const correct = mine?.answer === result.question.correct_option;
  const feedback = document.getElementById("feedback");
  feedback.textContent = correct ? "✅ Você acertou!" : mine ? "❌ Você errou." : "⏱️ Tempo esgotado.";
  feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
  document.getElementById("points").textContent = mine ? `+${mine.points || 0}` : "";
  document.getElementById("correct-answer").textContent = `Resposta: ${result.question.correct_option} — ${result.question[`option_${result.question.correct_option.toLowerCase()}`]}`;
  document.getElementById("explanation").textContent = [result.question.reference, result.question.explanation].filter(Boolean).join(" — ");
  renderRanking("ranking", players);
  document.getElementById("btn-next").classList.toggle("hidden", !isHost);
  document.getElementById("waiting-next").classList.toggle("hidden", isHost);
  showScreen("result");
}

document.getElementById("btn-next").addEventListener("click", async () => {
  if (!isHost) return;
  document.getElementById("btn-next").disabled = true;
  try {
    const next = await provider.nextQuestion(room.id);
    room = await provider.getRoom(room.id);
    if (next) await showQuestion(next);
    else await showFinal();
  } catch (error) {
    showFatal(error);
  } finally {
    document.getElementById("btn-next").disabled = false;
  }
});

async function showFinal() {
  players = (await provider.listPlayers(room.id)).sort((a, b) => b.score - a.score);
  renderRanking("final-ranking", players);
  showScreen("final");
}

function renderRanking(elementId, ranking) {
  const list = document.getElementById(elementId);
  list.innerHTML = "";
  ranking.forEach((item, index) => {
    const row = document.createElement("li");
    row.innerHTML = `<span>${medalFor(index)}</span><span>${item.nickname}</span><span class="name">${escapeHtml(item.name)}</span><span class="score">${item.score || 0}</span>`;
    list.appendChild(row);
  });
}

async function refreshPlayers() {
  players = await provider.listPlayers(room.id);
}

function inviteUrl(code) {
  const url = new URL("duelo.html", location.href);
  url.search = "";
  url.searchParams.set("room", code);
  return url.toString();
}

function saveSession() {
  if (!room || !player) return;
  localStorage.setItem(`bql_online_session_${room.code}`, JSON.stringify({ playerId: player.id }));
}

function setHomeBusy(busy) {
  document.getElementById("btn-create").disabled = busy;
  document.getElementById("btn-join").disabled = busy;
}

function showHomeError(error) {
  document.getElementById("home-error").textContent =
    error.message === "SALA_CHEIA" ? "A sala já possui 6 jogadores." : error.message || "Não foi possível continuar.";
}

function showFatal(error) {
  console.error(error);
  document.getElementById("fatal-error").textContent = error.message || "Erro inesperado.";
  showScreen("error");
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}
