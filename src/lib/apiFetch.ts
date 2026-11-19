let inFlightActivation: Promise<boolean> | null = null;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname + input.search;
  return input.url;
}

function isApiRequest(input: RequestInfo | URL): boolean {
  const url = getRequestUrl(input);
  if (url.startsWith("/api/")) return true;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(url, base);
    return parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isMswBypassedResponse(res: Response): boolean {
  if (res.status !== 404) return false;
  const contentType = res.headers?.get?.("content-type") ?? "";
  return !contentType.toLowerCase().includes("application/json");
}

function activateViaController(
  sw: ServiceWorkerContainer,
  controller: ServiceWorker,
  timeoutMs = 500,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "MOCKING_ENABLED") {
        finish();
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sw.removeEventListener("message", handleMessage);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    sw.addEventListener("message", handleMessage);

    try {
      controller.postMessage("MOCK_ACTIVATE");
    } catch {
      finish();
    }
  });
}

async function performMswReactivation(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker
  ) {
    return false;
  }

  const sw = navigator.serviceWorker;
  const hasGetRegistration = typeof sw.getRegistration === "function";
  const registration = hasGetRegistration
    ? await sw.getRegistration().catch(() => undefined)
    : undefined;
  const hasActiveRegistration =
    !hasGetRegistration || Boolean(registration?.active);
  const controller = sw.controller;

  if (
    controller &&
    controller.state !== "redundant" &&
    hasActiveRegistration
  ) {
    await activateViaController(sw, controller);
    return true;
  }

  const { worker } = await import("@/mocks/browser");
  try {
    worker.stop();
  } catch {
    // Ignore if worker was not started or already stopped
  }
  await worker.start({ onUnhandledRequest: "bypass" });
  return true;
}

export function ensureMswActive(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker
  ) {
    return Promise.resolve(false);
  }

  if (!inFlightActivation) {
    inFlightActivation = performMswReactivation().finally(() => {
      inFlightActivation = null;
    });
  }

  return inFlightActivation;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response =
    init === undefined ? await fetch(input) : await fetch(input, init);

  if (isApiRequest(input) && isMswBypassedResponse(response)) {
    const reactivated = await ensureMswActive();
    if (reactivated) {
      return init === undefined ? fetch(input) : fetch(input, init);
    }
  }

  return response;
}
