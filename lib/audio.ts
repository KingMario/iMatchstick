export function playApplause(audio: HTMLAudioElement | null) {
  audio ??= new Audio("./hurrah.mp3");
  audio.volume = 0.8;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  return audio;
}

export function pauseApplause(audio: HTMLAudioElement | null) {
  if (!audio || audio.paused) return;
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    /* Media may not be loaded yet. */
  }
}
