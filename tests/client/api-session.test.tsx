import { render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "@/features/session/session-guard";
import { api, ApiError, SessionExpiredError } from "@/lib/api";

const mockFetch = ({ payload, ...res }: Partial<Omit<Response, "body">> & { payload?: unknown }) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    type: "basic",
    ok: (res.status ?? 200) < 400,
    status: 200,
    json: async () => payload,
    ...res,
  } as Response);

afterEach(() => vi.restoreAllMocks());

describe("api()", () => {
  it("unwraps { data } and sends JSON with manual redirects", async () => {
    const spy = mockFetch({ payload: { data: { ok: 1 } } });
    await expect(api("/x", { method: "POST", json: { a: 1 } })).resolves.toEqual({ ok: 1 });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("/api/x");
    expect(init?.redirect).toBe("manual");
    expect(init?.body).toBe('{"a":1}');
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("raises ApiError with the server error body", async () => {
    mockFetch({ status: 400, payload: { error: { code: "VALIDATION_FAILED", message: "bad" } } });
    const err = await api("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).body?.error.code).toBe("VALIDATION_FAILED");
  });

  it("treats an Access redirect (opaqueredirect) as an expired session", async () => {
    mockFetch({ type: "opaqueredirect", status: 0 });
    await expect(api("/x")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("returns undefined for 204", async () => {
    mockFetch({ status: 204 });
    await expect(api("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("SessionGuard", () => {
  it("swaps the app for a re-login screen when the session expires", async () => {
    render(<SessionGuard><p>conteúdo do app</p></SessionGuard>);
    expect(screen.getByText("conteúdo do app")).toBeInTheDocument();

    mockFetch({ status: 401, payload: { error: { code: "UNAUTHENTICATED", message: "x" } } });
    await act(async () => {
      await api("/me").catch(() => undefined);
    });
    expect(screen.queryByText("conteúdo do app")).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Sua sessão expirou" })).toBeInTheDocument();
  });
});
