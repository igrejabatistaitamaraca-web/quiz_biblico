// ============================================================
// data-provider.js — abstrai a fonte de dados do jogo.
//
// Duas implementações da MESMA interface:
//   - DemoDataProvider:      tudo em memória/localStorage,
//                             sincronizado entre abas via
//                             BroadcastChannel (útil para testar
//                             TV + Controle no mesmo navegador,
//                             sem precisar configurar Supabase).
//   - SupabaseDataProvider:  usa tabelas + Realtime reais.
//
// tv.js e controle.js só conversam com esta interface, nunca
// diretamente com Supabase ou localStorage.
// ============================================================

import { DEMO_MODE, getSupabaseClient } from "./supabase.js";
import { DEMO_QUESTIONS } from "./questions.js";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function uuid() {
  return crypto.randomUUID();
}

/**
 * Normaliza uma linha da tabela "perguntas" (nomes de coluna em
 * português, resposta_correta em minúscula) para o formato interno
 * usado por tv.js / controle.js.
 */
function mapPergunta(row) {
  if (!row) return null;
  return {
    id: row.id,
    question: row.pergunta,
    option_a: row.alternativa_a,
    option_b: row.alternativa_b,
    option_c: row.alternativa_c,
    option_d: row.alternativa_d,
    correct_option: (row.resposta_correta || "").toUpperCase(),
    audio_url: row.audio_url || null,
    category: row.categoria,
    difficulty: row.dificuldade,
    type: row.tipo || "multiple_choice",
    time_limit: row.tempo_limite || 15,
    explanation: row.explicacao || "",
    reference: row.referencia || "",
  };
}

/**
 * Calcula pontos: base 100, decai linearmente com o tempo de resposta
 * até 0 no limite da pergunta. Nunca negativo. Resposta errada = 0.
 */
export function calcPoints(isCorrect, responseTimeSec, timeLimitSec) {
  if (!isCorrect) return 0;
  const base = 100;
  const speedFactor = Math.max(0, 1 - responseTimeSec / timeLimitSec);
  // garante um piso de 20% dos pontos para quem acerta mesmo no limite
  const points = base * (0.2 + 0.8 * speedFactor);
  return Math.max(0, Math.round(points));
}

// ------------------------------------------------------------
// DEMO DATA PROVIDER
// ------------------------------------------------------------
class DemoDataProvider {
  constructor() {
    this._bc = new BroadcastChannel("biblia-quiz-demo");
    this._listeners = new Map(); // roomId -> Set(callback)
    this._bc.onmessage = (ev) => {
      const { roomId, type, payload } = ev.data || {};
      if (!roomId) return;
      const set = this._listeners.get(roomId);
      if (set) set.forEach((cb) => cb(type, payload));
    };
  }

  _store() {
    const raw = localStorage.getItem("bql_demo_store");
    return raw ? JSON.parse(raw) : { rooms: {}, players: {}, answers: {} };
  }

  _save(store) {
    localStorage.setItem("bql_demo_store", JSON.stringify(store));
  }

  _emit(roomId, type, payload) {
    this._bc.postMessage({ roomId, type, payload });
    const set = this._listeners.get(roomId);
    if (set) set.forEach((cb) => cb(type, payload));
  }

  async createRoom() {
    const store = this._store();
    const room = {
      id: uuid(),
      code: genCode(),
      host_token: uuid(),
      status: "waiting",
      max_players: 6,
      current_question_id: null,
      current_question_index: -1,
      question_started_at: null,
      question_ends_at: null,
      created_at: new Date().toISOString(),
    };
    store.rooms[room.id] = room;
    this._save(store);
    return room;
  }

  async getRoomByCode(code) {
    const store = this._store();
    return Object.values(store.rooms).find((r) => r.code === code.toUpperCase()) || null;
  }

  async getRoom(roomId) {
    const store = this._store();
    return store.rooms[roomId] || null;
  }

  async getQuestion(questionId) {
    return DEMO_QUESTIONS.find((question) => question.id === questionId) || null;
  }

  async listPlayers(roomId) {
    const store = this._store();
    return Object.values(store.players).filter((p) => p.room_id === roomId);
  }

  async getPlayer(playerId) {
    const store = this._store();
    return store.players[playerId] || null;
  }

  async joinPlayer(roomId, name, icon) {
    const store = this._store();
    const room = store.rooms[roomId];
    if (!room) throw new Error("Sala não encontrada.");
    const current = Object.values(store.players).filter((p) => p.room_id === roomId);
    if (room.status !== "waiting") throw new Error("A partida já começou.");
    if (current.length >= room.max_players) throw new Error("SALA_CHEIA");

    const player = {
      id: uuid(),
      room_id: roomId,
      name,
      nickname: icon, // o "nickname" é o ícone escolhido
      score: 0,
      connected: true,
      joined_at: new Date().toISOString(),
    };
    store.players[player.id] = player;
    this._save(store);
    this._emit(roomId, "player_joined", player);
    return player;
  }

  async startGame(roomId) {
    const store = this._store();
    store.rooms[roomId].status = "playing";
    this._save(store);
    this._emit(roomId, "game_started", {});
    return this.nextQuestion(roomId);
  }

  async nextQuestion(roomId) {
    const store = this._store();
    const room = store.rooms[roomId];
    const nextIndex = room.current_question_index + 1;
    const question = DEMO_QUESTIONS[nextIndex];

    if (!question) {
      room.status = "finished";
      this._save(store);
      this._emit(roomId, "game_finished", {});
      return null;
    }

    const now = Date.now();
    room.current_question_id = question.id;
    room.current_question_index = nextIndex;
    room.status = "question_active";
    room.question_started_at = new Date(now).toISOString();
    room.question_ends_at = new Date(now + question.time_limit * 1000).toISOString();
    this._save(store);
    this._emit(roomId, "new_question", { question, room });
    return question;
  }

  async submitAnswer(roomId, questionId, playerId, answer) {
    const store = this._store();
    const room = store.rooms[roomId];
    const key = `${roomId}_${questionId}_${playerId}`;
    if (store.answers[key]) return store.answers[key]; // já respondeu

    const answeredAt = Date.now();
    const startedAt = new Date(room.question_started_at).getTime();
    const responseTime = Math.max(0, (answeredAt - startedAt) / 1000);

    const record = {
      id: uuid(),
      room_id: roomId,
      question_id: questionId,
      player_id: playerId,
      answer,
      answered_at: new Date(answeredAt).toISOString(),
      response_time: responseTime,
      points: 0, // calculado no fechamento da pergunta
    };
    store.answers[key] = record;
    this._save(store);
    this._emit(roomId, "answer_received", record);
    return record;
  }

  async getAnswers(roomId, questionId) {
    const store = this._store();
    return Object.values(store.answers).filter(
      (a) => a.room_id === roomId && a.question_id === questionId
    );
  }

  async getQuestionResult(roomId, questionId) {
    const question = await this.getQuestion(questionId);
    if (!question) return null;
    return {
      question,
      answers: await this.getAnswers(roomId, questionId),
      players: await this.listPlayers(roomId),
    };
  }

  async finishQuestion(roomId) {
    const store = this._store();
    const room = store.rooms[roomId];
    const question = DEMO_QUESTIONS[room.current_question_index];
    const answers = Object.values(store.answers).filter(
      (a) => a.room_id === roomId && a.question_id === question.id
    );

    for (const ans of answers) {
      const isCorrect = ans.answer === question.correct_option;
      ans.points = calcPoints(isCorrect, ans.response_time, question.time_limit);
      const player = store.players[ans.player_id];
      if (player) player.score += ans.points;
    }

    room.status = "showing_result";
    this._save(store);
    const players = Object.values(store.players).filter((p) => p.room_id === roomId);
    this._emit(roomId, "question_finished", { question, answers, players });
    return { question, answers, players };
  }

  subscribeRoom(roomId, callback) {
    if (!this._listeners.has(roomId)) this._listeners.set(roomId, new Set());
    this._listeners.get(roomId).add(callback);
    queueMicrotask(() => callback("subscribed", null));
    return () => this._listeners.get(roomId)?.delete(callback);
  }
}

// ------------------------------------------------------------
// SUPABASE DATA PROVIDER
// ------------------------------------------------------------
class SupabaseDataProvider {
  constructor() {
    this._client = null;
  }

  async _sb() {
    if (!this._client) this._client = await getSupabaseClient();
    return this._client;
  }

  async createRoom() {
    const sb = await this._sb();
    const code = genCode();
    const { data, error } = await sb
      .from("rooms")
      .insert({ code, status: "waiting", max_players: 6, current_question_index: -1 })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getRoomByCode(code) {
    const sb = await this._sb();
    const { data, error } = await sb
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getRoom(roomId) {
    const sb = await this._sb();
    const { data, error } = await sb.from("rooms").select("*").eq("id", roomId).single();
    if (error) throw error;
    return data;
  }

  async getQuestion(questionId) {
    const sb = await this._sb();
    const { data, error } = await sb
      .from("perguntas")
      .select("*")
      .eq("id", questionId)
      .single();
    if (error) throw error;
    return mapPergunta(data);
  }

  async listPlayers(roomId) {
    const sb = await this._sb();
    const { data, error } = await sb
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async getPlayer(playerId) {
    const sb = await this._sb();
    const { data, error } = await sb
      .from("players")
      .select("*")
      .eq("id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async joinPlayer(roomId, name, icon) {
    const sb = await this._sb();
    const players = await this.listPlayers(roomId);
    const room = await this.getRoom(roomId);
    if (room.status !== "waiting") throw new Error("A partida já começou.");
    if (players.length >= room.max_players) throw new Error("SALA_CHEIA");

    const { data, error } = await sb
      .from("players")
      .insert({ room_id: roomId, name, nickname: icon })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async startGame(roomId) {
    const sb = await this._sb();
    const { error } = await sb.from("rooms").update({ status: "playing" }).eq("id", roomId);
    if (error) throw error;
    return this.nextQuestion(roomId);
  }

  async nextQuestion(roomId) {
    const sb = await this._sb();
    const room = await this.getRoom(roomId);
    const nextIndex = room.current_question_index + 1;

    const { data: rows, error: qErr } = await sb
      .from("perguntas")
      .select("*")
      .eq("ativo", true)
      .order("id")
      .range(nextIndex, nextIndex);
    if (qErr) throw qErr;

    const question = mapPergunta(rows?.[0]);
    if (!question) {
      const { error } = await sb.from("rooms").update({ status: "finished" }).eq("id", roomId);
      if (error) throw error;
      return null;
    }

    const now = Date.now();
    const { error: roomError } = await sb
      .from("rooms")
      .update({
        current_question_id: question.id,
        current_question_index: nextIndex,
        status: "question_active",
        question_started_at: new Date(now).toISOString(),
        question_ends_at: new Date(now + question.time_limit * 1000).toISOString(),
      })
      .eq("id", roomId);
    if (roomError) throw roomError;

    return question;
  }

  async submitAnswer(roomId, questionId, playerId, answer) {
    const sb = await this._sb();
    const room = await this.getRoom(roomId);
    const answeredAt = Date.now();
    const startedAt = new Date(room.question_started_at).getTime();
    const responseTime = Math.max(0, (answeredAt - startedAt) / 1000);

    const { data, error } = await sb
      .from("answers")
      .insert({
        room_id: roomId,
        question_id: questionId,
        player_id: playerId,
        answer: answer.toUpperCase(),
        response_time: responseTime,
      })
      .select()
      .single();
    if (error) throw error; // unique constraint bloqueia resposta duplicada
    return data;
  }

  async getAnswers(roomId, questionId) {
    const sb = await this._sb();
    const { data, error } = await sb
      .from("answers")
      .select("*")
      .eq("room_id", roomId)
      .eq("question_id", questionId);
    if (error) throw error;
    return data;
  }

  async getQuestionResult(roomId, questionId) {
    const [question, answers, players] = await Promise.all([
      this.getQuestion(questionId),
      this.getAnswers(roomId, questionId),
      this.listPlayers(roomId),
    ]);
    return { question, answers, players };
  }

  async finishQuestion(roomId) {
    const sb = await this._sb();
    const room = await this.getRoom(roomId);
    const question = await this.getQuestion(room.current_question_id);

    const answers = await this.getAnswers(roomId, question.id);
    for (const ans of answers) {
      const isCorrect = ans.answer === question.correct_option;
      const points = calcPoints(isCorrect, ans.response_time, question.time_limit);
      const { error: answerError } = await sb.from("answers").update({ points }).eq("id", ans.id);
      if (answerError) throw answerError;
      const { data: player } = await sb
        .from("players")
        .select("score")
        .eq("id", ans.player_id)
        .single();
      const { error: playerError } = await sb
        .from("players")
        .update({ score: (player?.score || 0) + points })
        .eq("id", ans.player_id);
      if (playerError) throw playerError;
      ans.points = points;
    }

    const { error: roomError } = await sb
      .from("rooms")
      .update({ status: "showing_result" })
      .eq("id", roomId);
    if (roomError) throw roomError;
    const players = await this.listPlayers(roomId);
    return { question, answers, players };
  }

  subscribeRoom(roomId, callback) {
    let channel;
    (async () => {
      const sb = await this._sb();
      channel = sb
        .channel(`room:${roomId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          (payload) => callback("room_update", payload.new))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
          (payload) => callback("player_joined", payload.new))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` },
          (payload) => callback("answer_received", payload.new))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") callback("subscribed", null);
        });
    })();
    return () => channel && channel.unsubscribe();
  }
}

let _provider = null;
export function getDataProvider() {
  if (!_provider) _provider = DEMO_MODE ? new DemoDataProvider() : new SupabaseDataProvider();
  return _provider;
}
