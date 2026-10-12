import { useEffect, useId, useRef, useState } from "react";
import { ActionIcon } from "./ActionIcon";
import { type CopyText } from "./copy";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Status =
  | "idle"
  | "manual"
  | "prompting"
  | "accepted"
  | "dismissed"
  | "failed"
  | "installed";

export function InstallShortcut({ text }: { text: CopyText }) {
  const [status, setStatus] = useState<Status>("idle");
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">(
    "desktop",
  );
  const [secure, setSecure] = useState(true);
  const eventRef = useRef<InstallEvent | null>(null);
  const installedRef = useRef(false);
  const busy = useRef(false);
  const helpId = useId();

  useEffect(() => {
    const ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    setPlatform(
      ios ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop",
    );
    setSecure(window.isSecureContext);
    const standalone = window.matchMedia("(display-mode: standalone)");
    function installed() {
      installedRef.current = true;
      eventRef.current = null;
      setStatus("installed");
    }
    function checkStandalone() {
      if (
        standalone.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone
      )
        installed();
    }
    function beforeInstall(event: Event) {
      event.preventDefault();
      if (!installedRef.current) eventRef.current = event as InstallEvent;
    }
    checkStandalone();
    standalone.addEventListener("change", checkStandalone);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      standalone.removeEventListener("change", checkStandalone);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (busy.current || installedRef.current) return;
    const event = eventRef.current;
    if (!event) {
      setStatus("manual");
      return;
    }
    busy.current = true;
    eventRef.current = null;
    setStatus("prompting");
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (!installedRef.current) setStatus(choice.outcome);
    } catch {
      if (!installedRef.current) setStatus("failed");
    } finally {
      busy.current = false;
    }
  }

  const showHelp =
    status === "manual" || status === "dismissed" || status === "failed";
  return (
    <div className="install-shortcut">
      <button
        type="button"
        className="settings-share"
        onClick={() => void install()}
        disabled={
          status === "installed" ||
          status === "prompting" ||
          status === "accepted"
        }
        aria-expanded={showHelp}
        aria-controls={helpId}
      >
        <ActionIcon name="install" />
        {status === "installed"
          ? text.installInstalled
          : status === "prompting"
            ? text.installPrompting
            : text.installShortcut}
      </button>
      {status !== "idle" && status !== "manual" ? (
        <p className="install-feedback" role="status">
          {text.installStatus[status]}
        </p>
      ) : null}
      <div id={helpId} hidden={!showHelp}>
        <ol className="install-steps">
          {text.installSteps[platform].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="install-feedback">{text.installManualNote}</p>
        {!secure ? (
          <p className="install-feedback">{text.installSecureNote}</p>
        ) : null}
      </div>
    </div>
  );
}
