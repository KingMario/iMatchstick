export const academyStorageKey = "imatchstick-academy-v1";
export type AcademyProgress = {
  version: 1;
  welcomed: boolean;
  completedLessonIds: string[];
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const emptyAcademyProgress = (): AcademyProgress => ({
  version: 1,
  welcomed: false,
  completedLessonIds: [],
});

/** Only the academy namespace is migrated; competitive data is never modified. */
export function parseAcademyProgress(
  raw: string | null,
  knownIds: readonly string[],
): AcademyProgress {
  const empty = emptyAcademyProgress();
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return empty;
    const saved = value as Record<string, unknown>;
    // Preserve dismissal from future versions, without interpreting their data.
    const welcomed = saved.welcomed === true;
    if (saved.version !== 1 && saved.version !== 0)
      return { ...empty, welcomed };
    const ids =
      saved.version === 0 ? saved.completed : saved.completedLessonIds;
    return {
      version: 1,
      welcomed,
      completedLessonIds: Array.isArray(ids)
        ? [
            ...new Set(
              ids.filter(
                (id): id is string =>
                  typeof id === "string" && knownIds.includes(id),
              ),
            ),
          ]
        : [],
    };
  } catch {
    return empty;
  }
}

export function loadAcademy(
  storage: StorageLike | null,
  knownIds: readonly string[],
) {
  let progress = emptyAcademyProgress();
  let existingVisitor = false;
  try {
    if (storage) {
      progress = parseAcademyProgress(
        storage.getItem(academyStorageKey),
        knownIds,
      );
      // Even malformed legacy values establish a prior visit. Don't force a tour.
      existingVisitor =
        storage.getItem("imatchstick-pwa-settings") !== null ||
        storage.getItem("imatchstick-pwa-stats") !== null;
    }
  } catch {
    /* Storage can be blocked. A dismissible welcome still works. */
  }
  return { progress, showWelcome: !progress.welcomed && !existingVisitor };
}

export function saveAcademy(
  storage: StorageLike | null,
  progress: AcademyProgress,
) {
  try {
    storage?.setItem(academyStorageKey, JSON.stringify(progress));
  } catch {
    /* Session remains usable. */
  }
}
