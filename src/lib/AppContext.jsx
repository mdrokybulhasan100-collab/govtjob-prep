import { createContext, useContext } from "react";

export const AppContext = createContext(null);

// Any feature component can call useApp() to get everything it needs
// (user, cached data, navigation, and quiz-starting actions) without
// MainApp having to know or pass per-feature props.
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be called from inside AppContext.Provider");
  return ctx;
}
