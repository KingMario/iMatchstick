import { useCallback, useEffect, useRef, useState } from "react";
import {
  activateWorker,
  isNewerBuild,
  refreshWorker,
  withTimeout,
  workerBuildId,
} from "./pwaUpdate";

export const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
export const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
export type UpdateStatus =
  "idle" | "checking" | "latest" | "available" | "failed" | "unsupported";

export function usePwaUpdate() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [applying, setApplying] = useState(false);
  const registration = useRef<Promise<ServiceWorkerRegistration> | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  const getRegistration = useCallback(async () => {
    registration.current ??= navigator.serviceWorker.register("./sw.js", {
      updateViaCache: "none",
    });
    try {
      return await withTimeout(registration.current);
    } catch (error) {
      registration.current = null;
      throw error;
    }
  }, []);

  const check = useCallback(async () => {
    if (busy.current) return;
    if (buildId === "dev" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    busy.current = true;
    setStatus("checking");
    try {
      const worker = await refreshWorker(await getRegistration());
      if (!worker) throw new Error("Worker unavailable");
      const newer = isNewerBuild(await workerBuildId(worker), buildId);
      if (mounted.current) setStatus(newer ? "available" : "latest");
    } catch {
      if (mounted.current) setStatus("failed");
    } finally {
      busy.current = false;
    }
  }, [getRegistration]);

  useEffect(() => {
    mounted.current = true;
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    void check();
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [check]);

  const apply = async () => {
    if (busy.current) return;
    busy.current = true;
    setApplying(true);
    try {
      const reg = await getRegistration();
      // A downloaded update must remain usable when the network goes away.
      // Likewise, a newer worker may already be active in another open tab.
      let worker = reg.waiting ?? reg.active;
      if (!worker || !isNewerBuild(await workerBuildId(worker), buildId)) {
        worker = await refreshWorker(reg);
      }
      if (!worker) throw new Error("Worker unavailable");
      if (!isNewerBuild(await workerBuildId(worker), buildId)) {
        if (mounted.current) setStatus("latest");
        return;
      }
      if (worker.state !== "activated") await activateWorker(worker);
      if (mounted.current) window.location.reload();
    } catch {
      if (mounted.current) setStatus("failed");
    } finally {
      busy.current = false;
      if (mounted.current) setApplying(false);
    }
  };
  return { status, applying, check, apply };
}
