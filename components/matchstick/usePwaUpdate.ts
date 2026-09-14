import { useCallback, useEffect, useRef, useState } from "react";

export const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
export const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
export type UpdateStatus =
  "idle" | "checking" | "latest" | "available" | "failed" | "unsupported";

async function workerBuildId(worker: ServiceWorker) {
  return new Promise<string>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error("Worker unavailable"));
    }, 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data);
    };
    worker.postMessage({ type: "BUILD_ID" }, [channel.port2]);
  });
}

export function usePwaUpdate() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [applying, setApplying] = useState(false);
  const registration = useRef<Promise<ServiceWorkerRegistration> | null>(null);
  const busy = useRef(false);
  const reloadRequested = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    if (buildId === "dev" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    busy.current = true;
    setStatus("checking");
    try {
      registration.current ??= navigator.serviceWorker.register("./sw.js", {
        updateViaCache: "none",
      });
      const reg = await registration.current;
      await reg.update();
      // update() can resolve before the new worker finishes precaching.
      const installing = reg.installing;
      if (installing)
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(
            () => finish(new Error("Update timed out")),
            30000,
          );
          const changed = () => {
            if (
              installing.state === "installed" ||
              installing.state === "activated"
            )
              finish();
            else if (installing.state === "redundant")
              finish(new Error("Update failed"));
          };
          const finish = (error?: Error) => {
            clearTimeout(timeout);
            installing.removeEventListener("statechange", changed);
            if (error) reject(error);
            else resolve();
          };
          installing.addEventListener("statechange", changed);
          changed();
        });
      const worker = reg.waiting ?? reg.active;
      if (!worker) throw new Error("Worker unavailable");
      setStatus(
        (await workerBuildId(worker)) !== buildId ? "available" : "latest",
      );
    } catch {
      registration.current = null;
      setStatus("failed");
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (buildId === "dev" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    const onController = () => {
      if (reloadRequested.current) window.location.reload();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    void check();
    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onController,
      );
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [check]);

  const apply = async () => {
    try {
      const reg = await registration.current;
      if (!reg?.waiting) {
        if (reg?.active && (await workerBuildId(reg.active)) !== buildId)
          window.location.reload();
        else await check();
        return;
      }
      reloadRequested.current = true;
      setApplying(true);
      reg.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
    } catch {
      setApplying(false);
      setStatus("failed");
    }
  };
  return { status, applying, check, apply };
}
