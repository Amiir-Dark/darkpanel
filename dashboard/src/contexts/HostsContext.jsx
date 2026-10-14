import { fetch } from "service/http";
import { create } from "zustand";
let hostsFetchSequence = 0;
export const useHosts = create((set) => ({
    isLoading: false,
    isPostLoading: false,
    hosts: {},
    async fetchHosts() {
        const requestId = ++hostsFetchSequence;
        set({ isLoading: true });
        try {
            const hosts = await fetch("/hosts");
            if (requestId !== hostsFetchSequence)
                return;
            // Ensure hosts is always an object, even if API returns null/undefined
            set({ hosts: hosts || {} });
        }
        catch (error) {
            if (requestId !== hostsFetchSequence)
                return;
            console.error("Failed to fetch hosts:", error);
            set({ hosts: {} });
        }
        finally {
            if (requestId === hostsFetchSequence) {
                set({ isLoading: false });
            }
        }
    },
    setHosts: (body) => {
        set({ isPostLoading: true });
        return fetch("/hosts", { method: "PUT", body }).finally(() => {
            set({ isPostLoading: false });
        });
    },
    setHostStatus: (hostId, isDisabled) => {
        set({ isPostLoading: true });
        return fetch(`/hosts/${hostId}/status`, {
            method: "PUT",
            body: { is_disabled: isDisabled },
        }).finally(() => {
            set({ isPostLoading: false });
        });
    },
}));
export const clearHostsCache = () => {
    hostsFetchSequence += 1;
    useHosts.setState({
        isLoading: false,
        isPostLoading: false,
        hosts: {},
    });
};
