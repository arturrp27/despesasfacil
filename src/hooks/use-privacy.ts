import { useSyncExternalStore } from "react";

// Valores ocultos por padrão (não persistido: sempre inicia oculto)
let hidden = true;
const listeners = new Set<() => void>();

export const isPrivacyHidden = () => hidden;

export function setPrivacyHidden(value: boolean) {
  hidden = value;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePrivacy() {
  const value = useSyncExternalStore(
    subscribe,
    () => hidden,
    () => true,
  );
  return {
    hidden: value,
    toggle: () => setPrivacyHidden(!hidden),
    setHidden: setPrivacyHidden,
  };
}
