"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef } from "react";

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const drafts = useRef(new Set());
  const register = useCallback((id, dirty) => {
    if (dirty) drafts.current.add(id);
    else drafts.current.delete(id);
  }, []);

  useEffect(() => {
    function beforeUnload(event) {
      if (!drafts.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function followLink(event) {
      if (!drafts.current.size || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const signingOut = event.target.closest?.("button[data-leave-workspace]");
      if (!signingOut) {
        const link = event.target.closest?.("a[href]");
        if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
        const next = new URL(link.href, window.location.href);
        if (next.origin !== window.location.origin ||
            (next.pathname === window.location.pathname && next.search === window.location.search)) return;
      }
      if (!window.confirm("You have unsaved changes. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", followLink, true);
    };
  }, []);

  return <UnsavedChangesContext.Provider value={register}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges(dirty) {
  const register = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => {
    register?.(id, dirty);
    return () => register?.(id, false);
  }, [register, id, dirty]);
}
