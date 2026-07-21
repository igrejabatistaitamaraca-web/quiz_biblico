// ============================================================
// game.js — utilitários compartilhados entre tv.js e controle.js
// ============================================================

export const ROOM_STATUS = {
  WAITING: "waiting",
  PLAYING: "playing",
  QUESTION_ACTIVE: "question_active",
  SHOWING_RESULT: "showing_result",
  FINISHED: "finished",
};

/**
 * Roda um cronômetro visual LOCAL (sem tráfego de rede), baseado no
 * horário oficial `endsAtISO` vindo do servidor/estado da sala.
 * Chama onTick(secondsLeft) a cada segundo e onDone() ao zerar.
 */
export function runLocalTimer(endsAtISO, onTick, onDone) {
  const endsAt = new Date(endsAtISO).getTime();
  let cancelled = false;

  function tick() {
    if (cancelled) return;
    const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    onTick(secondsLeft);
    if (secondsLeft <= 0) {
      onDone();
      return;
    }
    setTimeout(tick, 250);
  }
  tick();

  return () => { cancelled = true; };
}

/**
 * Gera um QR Code dentro do elemento `el` apontando para a URL de
 * controle da sala. Usa a lib qrcodejs carregada via CDN no HTML.
 */
export function renderQrCode(el, url) {
  el.innerHTML = "";
  // eslint-disable-next-line no-undef
  new QRCode(el, {
    text: url,
    width: 220,
    height: 220,
    colorDark: "#1a1a2e",
    colorLight: "#f5efe0",
  });
}

export function controllerUrl(roomCode) {
  const base = new URL("controle.html", window.location.href);
  base.searchParams.set("room", roomCode);
  return base.toString();
}

export function medalFor(position) {
  return ["🥇", "🥈", "🥉"][position] || `${position + 1}º`;
}
