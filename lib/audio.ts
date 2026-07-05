export function playApplause(audio: HTMLAudioElement | null) {
  audio ??= new Audio("./hurrah.mp3");
  audio.volume = 0.8;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
