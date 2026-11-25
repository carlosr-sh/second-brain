import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

/** Ephemeral, app-wide UI state (dialogs and drawers). Persistent prefs live in settings. */
interface UiState {
  paletteOpen: boolean;
  setPaletteOpen: Dispatch<SetStateAction<boolean>>;
  captureOpen: boolean;
  setCaptureOpen: Dispatch<SetStateAction<boolean>>;
  shortcutsOpen: boolean;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  mobileNavOpen: boolean;
  setMobileNavOpen: Dispatch<SetStateAction<boolean>>;
}

const UiStateContext = createContext<UiState | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const value = useMemo(
    () => ({ paletteOpen, setPaletteOpen, captureOpen, setCaptureOpen, shortcutsOpen, setShortcutsOpen, mobileNavOpen, setMobileNavOpen }),
    [paletteOpen, captureOpen, shortcutsOpen, mobileNavOpen],
  );
  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

export function useUiState(): UiState {
  const ctx = useContext(UiStateContext);
  if (!ctx) throw new Error("useUiState must be used inside <UiStateProvider>");
  return ctx;
}
