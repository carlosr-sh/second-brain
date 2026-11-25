import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDocumentReady } from "@/features/offline/document-ready";
import { OfflineBanner } from "@/features/offline/offline-banner";
import { isOfflineEnabled, setOfflineEnabled, shouldPersistQuery } from "@/features/offline/offline-store";
import { reloginUrl } from "@/features/session/session-guard";
import { api, ApiError, NetworkError } from "@/lib/api";
import { errorMessage } from "@/lib/toast-error";

// onlineManager is a singleton: never let one test's "offline" leak into the next.
beforeEach(() => onlineManager.setOnline(true));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  onlineManager.setOnline(true);
});

const setOnline = (online: boolean) => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  window.dispatchEvent(new Event(online ? "online" : "offline"));
};

describe("what goes into the offline copy", () => {
  const q = (queryKey: unknown[], status = "success") => ({ queryKey, state: { status } }) as never;

  it("keeps successful data queries", () => {
    expect(shouldPersistQuery(q(["para", "tasks", {}]))).toBe(true);
    expect(shouldPersistQuery(q(["kb", "note", "id-1"]))).toBe(true);
    expect(shouldPersistQuery(q(["life", "journal", "2026-11-25"]))).toBe(true);
  });

  it("never keeps failed/pending queries, search, system, audit or identity", () => {
    expect(shouldPersistQuery(q(["para", "tasks"], "error"))).toBe(false);
    expect(shouldPersistQuery(q(["para", "tasks"], "pending"))).toBe(false);
    expect(shouldPersistQuery(q(["kb", "search", "senha", ""]))).toBe(false);
    expect(shouldPersistQuery(q(["system", "status"]))).toBe(false);
    expect(shouldPersistQuery(q(["audit-logs"]))).toBe(false);
    expect(shouldPersistQuery(q(["me"]))).toBe(false);
  });

  it("is on by default and can be turned off per device", () => {
    expect(isOfflineEnabled()).toBe(true);
    setOfflineEnabled(false);
    expect(isOfflineEnabled()).toBe(false);
  });
});

describe("api() without connection", () => {
  it("turns a fetch TypeError into NetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/tasks")).rejects.toBeInstanceOf(NetworkError);
  });

  it("fails writes immediately when offline, without touching the network", async () => {
    onlineManager.setOnline(false); // what the mounted QueryClient does on the "offline" event
    const spy = vi.spyOn(globalThis, "fetch");
    await expect(api("/tasks", { method: "POST", json: {} })).rejects.toBeInstanceOf(NetworkError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("explains errors: server message, offline notice, fallback", () => {
    expect(errorMessage(new NetworkError(), "x")).toBe("Sem conexão — nada foi salvo");
    expect(errorMessage(new ApiError(409, { error: { code: "CONFLICT", message: "Já existe" } }), "x")).toBe("Já existe");
    expect(errorMessage(new Error("boom"), "Erro")).toBe("Erro");
  });
});

describe("offline banner", () => {
  it("appears when the connection drops and disappears when it returns", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent("Sem conexão");
    act(() => setOnline(true));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Wi-Fi without internet (navigator.onLine stays true)", () => {
  it("a request failing at the network level switches the app to offline; the health probe switches it back", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await act(() => expect(api("/tasks")).rejects.toBeInstanceOf(NetworkError));
    expect(screen.getByRole("status")).toHaveTextContent("Sem conexão");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({ type: "basic", status: 200, ok: true } as Response);
    act(() => void window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

describe("re-login", () => {
  it("goes through /auth/login (outside the service worker) and returns to the same page", () => {
    expect(reloginUrl({ pathname: "/finance", search: "?tab=accounts" })).toBe("/auth/login?next=%2Ffinance%3Ftab%3Daccounts");
  });
});

describe("editors never start from a copy about to be replaced", () => {
  const q = (isPending: boolean, fetchStatus: "fetching" | "paused" | "idle", isFetchedAfterMount: boolean) => ({ isPending, fetchStatus, isFetchedAfterMount });
  it("waits while a restored copy is being revalidated", () => expect(isDocumentReady(q(false, "fetching", false))).toBe(false));
  it("uses the saved copy offline (request paused)", () => expect(isDocumentReady(q(false, "paused", false))).toBe(true));
  it("uses fresh data and in-session cache", () => {
    expect(isDocumentReady(q(false, "idle", true))).toBe(true);
    expect(isDocumentReady(q(false, "idle", false))).toBe(true);
    expect(isDocumentReady(q(false, "fetching", true))).toBe(true); // background refresh after first load: keep the editor
  });
  it("waits for the first load", () => expect(isDocumentReady(q(true, "fetching", false))).toBe(false));
});
