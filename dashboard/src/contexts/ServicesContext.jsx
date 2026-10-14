import { fetch } from "service/http";
import { create } from "zustand";
export const lastServicePageOffset = (total, limit) => {
    if (total <= 0 || limit <= 0) {
        return 0;
    }
    return Math.floor((total - 1) / limit) * limit;
};
let servicesFetchSequence = 0;
let serviceSummaryFetchSequence = 0;
let serviceOptionsFetchSequence = 0;
let serviceDetailFetchSequence = 0;
let lastServiceListParams = { limit: 20, offset: 0 };
export const useServicesStore = create((set, get) => ({
    services: [],
    summaryServices: [],
    serviceOptions: [],
    total: 0,
    isLoading: false,
    isOptionsLoading: false,
    isSaving: false,
    serviceDetail: null,
    async fetchServices(params = {}) {
        const requestId = ++servicesFetchSequence;
        lastServiceListParams = { ...params };
        set({ isLoading: true });
        try {
            const response = await fetch("/v2/services", {
                query: params,
            });
            if (requestId !== servicesFetchSequence) {
                return;
            }
            const limit = Number(params.limit ?? 20);
            const offset = Number(params.offset ?? 0);
            if (response.services.length === 0 &&
                response.total > 0 &&
                offset > 0) {
                const clamped = lastServicePageOffset(response.total, limit);
                if (clamped !== offset) {
                    await get().fetchServices({ ...params, offset: clamped });
                    return;
                }
            }
            set({ services: response.services, total: response.total });
        }
        finally {
            if (requestId === servicesFetchSequence) {
                set({ isLoading: false });
            }
        }
    },
    async fetchServiceSummary() {
        const requestId = ++serviceSummaryFetchSequence;
        const response = await fetch("/v2/services", {
            query: { limit: "none", offset: 0 },
        });
        if (requestId !== serviceSummaryFetchSequence) {
            return;
        }
        set({ summaryServices: response.services });
    },
    async refreshServices() {
        await Promise.all([
            get().fetchServices(lastServiceListParams),
            get().fetchServiceSummary(),
        ]);
    },
    async fetchServiceOptions(params) {
        if (!params?.force && get().serviceOptions.length > 0) {
            return get().serviceOptions;
        }
        const requestId = ++serviceOptionsFetchSequence;
        set({ isOptionsLoading: true });
        try {
            const response = await fetch("/v2/services", {
                query: { limit: 1000, offset: 0, ...params },
            });
            if (requestId !== serviceOptionsFetchSequence) {
                return get().serviceOptions;
            }
            set({ serviceOptions: response.services });
            return response.services;
        }
        finally {
            if (requestId === serviceOptionsFetchSequence) {
                set({ isOptionsLoading: false });
            }
        }
    },
    async fetchServiceDetail(id) {
        const requestId = ++serviceDetailFetchSequence;
        set({ isLoading: true });
        try {
            const detail = await fetch(`/v2/services/${id}`);
            if (requestId !== serviceDetailFetchSequence) {
                return null;
            }
            set({ serviceDetail: detail });
            return detail;
        }
        catch (error) {
            if (requestId !== serviceDetailFetchSequence) {
                return null;
            }
            throw error;
        }
        finally {
            if (requestId === serviceDetailFetchSequence) {
                set({ isLoading: false });
            }
        }
    },
    async createService(payload) {
        set({ isSaving: true });
        try {
            const detail = await fetch("/v2/services", {
                method: "POST",
                body: payload,
            });
            set({ serviceDetail: detail });
            await get().refreshServices();
            await get().fetchServiceOptions();
            return detail;
        }
        finally {
            set({ isSaving: false });
        }
    },
    async updateService(id, payload) {
        set({ isSaving: true });
        try {
            const detail = await fetch(`/v2/services/${id}`, {
                method: "PUT",
                body: payload,
            });
            set({ serviceDetail: detail });
            await get().refreshServices();
            await get().fetchServiceOptions();
            return detail;
        }
        finally {
            set({ isSaving: false });
        }
    },
    async deleteService(id, payload) {
        set({ isSaving: true });
        try {
            await fetch(`/v2/services/${id}`, { method: "DELETE", body: payload });
            set({ serviceDetail: null });
            await get().refreshServices();
            await get().fetchServiceOptions();
        }
        finally {
            set({ isSaving: false });
        }
    },
    async resetServiceUsage(id) {
        set({ isSaving: true });
        try {
            const detail = await fetch(`/v2/services/${id}/reset-usage`, {
                method: "POST",
            });
            set({ serviceDetail: detail });
            await get().refreshServices();
            await get().fetchServiceOptions();
            return detail;
        }
        finally {
            set({ isSaving: false });
        }
    },
    async updateServiceAdminLimits(serviceId, adminId, payload) {
        const updated = await fetch(`/v2/services/${serviceId}/admins/${adminId}/limits`, {
            method: "PUT",
            body: payload,
        });
        const current = get().serviceDetail;
        if (current?.id === serviceId) {
            set({
                serviceDetail: {
                    ...current,
                    admins: current.admins.map((item) => item.id === adminId ? updated : item),
                },
            });
        }
        return updated;
    },
    setServiceDetail(service) {
        set({ serviceDetail: service });
    },
    async performServiceUserAction(id, payload) {
        return fetch(`/v2/services/${id}/users/actions`, {
            method: "POST",
            body: payload,
        });
    },
}));
export const clearServicesCache = () => {
    servicesFetchSequence += 1;
    serviceOptionsFetchSequence += 1;
    useServicesStore.setState({
        services: [],
        serviceOptions: [],
        total: 0,
        isLoading: false,
        isOptionsLoading: false,
        isSaving: false,
        serviceDetail: null,
    });
};
