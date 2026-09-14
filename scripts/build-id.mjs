export function buildDay(createdAt) {
  return new Date(new Date(createdAt).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
}

export function formatBuildId(day, sequence, attempt = 1) {
  if (!Number.isInteger(sequence) || sequence < 1)
    throw new Error("Invalid build sequence");
  return `${day.replaceAll("-", "")}.${String(sequence).padStart(2, "0")}${attempt > 1 ? `-r${attempt}` : ""}`;
}
