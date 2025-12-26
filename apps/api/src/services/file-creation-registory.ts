// Global registry for in-flight project creations, keyed by creationId.
// Stored on globalThis to survive HMR (hot module reload).

const GLOBAL_KEY = "__project_creation_abort_registry__";

interface CreationRegistry {
  controllers: Map<string, AbortController>;
}

function getRegistry(): CreationRegistry {
  const g = globalThis as any;

  if (!g[GLOBAL_KEY]) {
    // Freeze the container so it can’t be overwritten accidentally.
    g[GLOBAL_KEY] = Object.freeze({
      controllers: new Map<string, AbortController>(),
    }) as CreationRegistry;
  }

  return g[GLOBAL_KEY] as CreationRegistry;
}

export function registerCreation(
  creationId: string,
  controller: AbortController,
) {
  const { controllers } = getRegistry();
  controllers.set(creationId, controller);
}

export function abortCreation(creationId: string): boolean {
  const { controllers } = getRegistry();
  const ctrl = controllers.get(creationId);

  if (!ctrl) return false;

  try {
    ctrl.abort();
  } finally {
    controllers.delete(creationId);
  }

  return true;
}

export function clearCreation(creationId: string) {
  getRegistry().controllers.delete(creationId);
}
