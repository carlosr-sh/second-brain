import { SystemPanel } from "./components/system-panel";

export function App() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Second Brain</h1>
        <p className="text-sm text-neutral-500">Fase 1 — infraestrutura e autenticação</p>
      </header>
      <SystemPanel />
    </main>
  );
}
