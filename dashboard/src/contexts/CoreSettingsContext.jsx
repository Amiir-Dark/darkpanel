import { fetch } from "service/http";
import { parseCoreConfig } from "utils/coreConfig";
import { create } from "zustand";
let coreFetchSequence = 0;
let coreFetchAbortController = null;
export const useCoreSettings = create((set, get) => ({
    isLoading: true,
    isPostLoading: false,
    version: null,
    started: false,
    logs_websocket: null,
    runtimeLoaded: false,
    configTargets: [],
    config: null,
    fetchConfigTargets: async () => {
        const response = await fetch("/core/config/targets");
        const targets = response?.targets || [];
        set({ configTargets: targets });
        return targets;
    },
    fetchCoreSettings: async (target = "master") => {
        const requestId = ++coreFetchSequence;
        coreFetchAbortController?.abort();
        const abortController = new AbortController();
        coreFetchAbortController = abortController;
        set({ isLoading: true });
        try {
            const [core, config] = await Promise.all([
                get().runtimeLoaded
                    ? Promise.resolve(null)
                    : fetch("/core", { signal: abortController.signal }),
                fetch("/core/config", {
                    query: { target },
                    signal: abortController.signal,
                }),
            ]);
            if (requestId !== coreFetchSequence || abortController.signal.aborted)
                return;
            set({
                ...(core
                    ? {
                        version: core.version,
                        started: core.started,
                        logs_websocket: core.logs_websocket,
                        runtimeLoaded: true,
                    }
                    : {}),
                config: parseCoreConfig(config),
            });
        }
        catch (error) {
            if (requestId !== coreFetchSequence || abortController.signal.aborted)
                return;
            console.error("Error fetching core settings:", error);
            throw error;
        }
        finally {
            if (requestId === coreFetchSequence) {
                if (coreFetchAbortController === abortController) {
                    coreFetchAbortController = null;
                }
                set({ isLoading: false });
            }
        }
    },
    updateConfig: (body, target = "master") => {
        set({ isPostLoading: true });
        return fetch("/core/config", {
            method: "PUT",
            query: { target },
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" },
        })
            .then(parseCoreConfig)
            .then(() => undefined)
            .catch((error) => {
            console.error("Update error:", error);
            throw error;
        })
            .finally(() => set({ isPostLoading: false }));
    },
    updateConfigTargetMode: (nodeId, mode) => {
        return fetch(`/core/config/targets/${nodeId}/mode`, {
            method: "PUT",
            body: { mode },
        });
    },
    restartCore: (target) => {
        return fetch("/core/restart", {
            method: "POST",
            query: target ? { target } : undefined,
        });
    },
}));
