// Every browser operation is bounded: Safari can suspend a worker or an update.
export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Update timed out")), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function isNewerBuild(candidate: string, current: string) {
  const parse = (value: string) => /^(\d{8})\.(\d+)(?:-r(\d+))?$/.exec(value);
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return candidate !== current;
  for (let i = 1; i <= 3; i++) {
    const difference = Number(a[i] ?? 1) - Number(b[i] ?? 1);
    if (difference) return difference > 0;
  }
  return false;
}

export function workerBuildId(worker: ServiceWorker) {
  return new Promise<string>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error, value?: string) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(
      () => finish(new Error("Worker unavailable")),
      5000,
    );
    channel.port1.onmessage = (event) => {
      if (typeof event.data !== "string")
        finish(new Error("Invalid worker version"));
      else finish(undefined, event.data);
    };
    try {
      worker.postMessage({ type: "BUILD_ID" }, [channel.port2]);
    } catch {
      finish(new Error("Worker unavailable"));
    }
  });
}

export function waitForWorker(
  worker: ServiceWorker,
  activating = false,
  timeoutMs = 30000,
) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", changed);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => {
      if (
        worker.state === "activated" ||
        (!activating && worker.state === "installed")
      )
        finish();
      else if (worker.state === "redundant") finish(new Error("Update failed"));
    };
    const timer = setTimeout(
      () => finish(new Error("Update timed out")),
      timeoutMs,
    );
    worker.addEventListener("statechange", changed);
    changed();
  });
}

export async function refreshWorker(reg: ServiceWorkerRegistration) {
  await withTimeout(reg.update());
  if (reg.installing) await waitForWorker(reg.installing);
  return reg.waiting ?? reg.active;
}

export async function activateWorker(worker: ServiceWorker) {
  // Subscribe before posting; activation can complete without controllerchange
  // (for example when this tab has not yet been controlled).
  const activated = waitForWorker(worker, true);
  try {
    worker.postMessage({ type: "ACTIVATE_UPDATE" });
  } catch {
    /* The bounded state wait reports the failure and removes its listener. */
  }
  await activated;
}
