"use client";
// An in-app alarm for urgent events (a trip cancelled while the driver has the app open). Browsers allow sound
// only after the person has touched the page, which a driver using the dashboard always has. When they haven't,
// this fails quietly and the on-screen banner still shows.

export function playAlert() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600]);
  } catch {}
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    void ctx.resume();
    // Three rising double-beeps, loud enough to notice but not a siren.
    [0, 0.45, 0.9].forEach((offset) => {
      [880, 1175].forEach((freq, i) => {
        const start = ctx.currentTime + offset + i * 0.17;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.16);
      });
    });
    setTimeout(() => void ctx.close(), 2000);
  } catch {}
}
