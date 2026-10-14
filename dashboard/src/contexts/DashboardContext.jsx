import { fetch } from "service/http";
import { queryClient } from "utils/react-query";
import { matchesSearch } from "utils/searchMatch";
import { getUsersPerPageLimitSize } from "utils/userPreferenceStorage";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
const DEFAULT_SORT = "-created_at";
const StatisticsQueryKey = "statistics-query-key";
const USERS_CACHE_WINDOW_MS = 60 * 60 * 1000;
const createEmptyUsersResponse = () => ({
    users: [],
    total: 0,
    active_total: 0,
    users_limit: null,
    status_breakdown: {},
    usage_total: null,
    online_total: null,
});
const createDefaultFilters = () => ({
    limit: getUsersPerPageLimitSize(),
    sort: DEFAULT_SORT,
    advancedFilters: [],
    owner: undefined,
    serviceId: undefined,
});
const sanitizeFilterQuery = (query) => {
    const normalized = {
        sort: query.sort || DEFAULT_SORT,
    };
    Object.keys(query).forEach((key) => {
        if (key === "sort") {
            return;
        }
        const value = query[key];
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return;
            }
            normalized[key] = value;
            return;
        }
        if (value === undefined || value === null || value === "") {
            return;
        }
        normalized[key] = value;
    });
    return normalized;
};
const buildUsersCacheKey = (query) => {
    return JSON.stringify(Object.keys(query)
        .sort()
        .map((key) => [key, query[key]]));
};
const isAbortError = (error) => {
    if (!error || typeof error !== "object") {
        return false;
    }
    const maybeError = error;
    return (maybeError.name === "AbortError" || maybeError.message === "AbortError");
};
const getUserSearchRank = (user, search, options) => {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
        return Number.MAX_SAFE_INTEGER;
    }
    const username = user.username ?? "";
    if (options.matchCase
        ? username === normalizedSearch
        : username.toLocaleLowerCase() === normalizedSearch.toLocaleLowerCase()) {
        return 0;
    }
    if (matchesSearch(username, normalizedSearch, options)) {
        return 1;
    }
    const searchableValues = [
        user.subscription_url,
        ...(user.subscription_urls ? Object.values(user.subscription_urls) : []),
        ...(user.links ?? []),
        user.service_name,
        user.admin_username,
    ].filter((value) => Boolean(value));
    return searchableValues.some((value) => matchesSearch(value, normalizedSearch, options))
        ? 2
        : Number.MAX_SAFE_INTEGER;
};
const normalizeUsersListResponse = (response, query) => {
    const seen = new Set();
    let users = (response.users ?? []).filter((user) => {
        const key = user.username || user.subscription_url;
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
    const total = response.total ?? users.length;
    const search = query.search?.trim();
    const searchOptions = {
        matchCase: Boolean(query.matchCase),
        matchWholeWord: Boolean(query.matchWholeWord),
    };
    if (search && users.length > total) {
        const rankedMatches = users
            .map((user, index) => ({
            user,
            index,
            rank: getUserSearchRank(user, search, searchOptions),
        }))
            .filter((entry) => entry.rank < Number.MAX_SAFE_INTEGER)
            .sort((a, b) => a.rank - b.rank || a.index - b.index)
            .map((entry) => entry.user);
        if (rankedMatches.length >= Math.max(total, 1)) {
            users = rankedMatches.slice(0, Math.max(total, 0));
        }
        else if (total >= 0) {
            users = users.slice(0, total);
        }
    }
    return {
        ...response,
        users,
        total,
    };
};
let usersFetchSequence = 0;
let usersAbortController = null;
let inboundsFetchSequence = 0;
let inboundsAbortController = null;
let editingUserFetchSequence = 0;
const fetchUsers = (query, options = {}) => {
    const sanitizedQuery = sanitizeFilterQuery(query);
    const cacheKey = buildUsersCacheKey(sanitizedQuery);
    const currentAuthToken = "session";
    const { lastUsersFetchAt, usersCacheKey, usersCacheAuthToken, users } = useDashboard.getState();
    const now = Date.now();
    if (!options.force &&
        lastUsersFetchAt &&
        usersCacheKey === cacheKey &&
        usersCacheAuthToken === currentAuthToken &&
        now - lastUsersFetchAt < USERS_CACHE_WINDOW_MS) {
        return Promise.resolve(users);
    }
    const requestId = ++usersFetchSequence;
    usersAbortController?.abort();
    const abortController = new AbortController();
    usersAbortController = abortController;
    useDashboard.setState({ loading: true });
    const requestQuery = {
        ...sanitizedQuery,
    };
    if (sanitizedQuery.advancedFilters?.length) {
        requestQuery.filter = sanitizedQuery.advancedFilters;
    }
    if (sanitizedQuery.owner) {
        requestQuery.admin = sanitizedQuery.owner;
    }
    if (sanitizedQuery.serviceId !== undefined) {
        requestQuery.service_id = sanitizedQuery.serviceId;
    }
    requestQuery.match_case = Boolean(sanitizedQuery.matchCase);
    requestQuery.match_whole_word = Boolean(sanitizedQuery.matchWholeWord);
    requestQuery.links = true;
    delete requestQuery.advancedFilters;
    delete requestQuery.owner;
    delete requestQuery.serviceId;
    delete requestQuery.matchCase;
    delete requestQuery.matchWholeWord;
    return fetch("/users", {
        query: requestQuery,
        signal: abortController.signal,
    })
        .then((usersResponse) => {
        if (requestId !== usersFetchSequence || abortController.signal.aborted) {
            return useDashboard.getState().users;
        }
        const normalizedResponse = normalizeUsersListResponse(usersResponse, sanitizedQuery);
        const previousUsers = new Map(useDashboard
            .getState()
            .users.users.map((user) => [user.username, user]));
        normalizedResponse.users = normalizedResponse.users.map((user) => {
            const previous = previousUsers.get(user.username);
            return {
                ...user,
                upload_speed: user.upload_speed ?? previous?.upload_speed,
                download_speed: user.download_speed ?? previous?.download_speed,
            };
        });
        const limit = normalizedResponse.users_limit ?? null;
        const activeTotal = normalizedResponse.active_total ?? null;
        const isUserLimitReached = limit !== null &&
            limit !== undefined &&
            limit > 0 &&
            activeTotal !== null
            ? activeTotal >= limit
            : false;
        useDashboard.setState({
            users: normalizedResponse,
            linkTemplates: normalizedResponse.link_templates, // Store link_templates separately for easy access
            isUserLimitReached,
            lastUsersFetchAt: Date.now(),
            usersCacheKey: cacheKey,
            usersCacheAuthToken: currentAuthToken,
        });
        return normalizedResponse;
    })
        .catch((error) => {
        if (requestId !== usersFetchSequence ||
            abortController.signal.aborted ||
            isAbortError(error)) {
            return useDashboard.getState().users;
        }
        console.error("Failed to fetch users:", error);
        const emptyResponse = createEmptyUsersResponse();
        useDashboard.setState({
            users: emptyResponse,
            linkTemplates: undefined,
            isUserLimitReached: false,
            lastUsersFetchAt: null,
            usersCacheKey: null,
            usersCacheAuthToken: null,
        });
        return emptyResponse;
    })
        .finally(() => {
        if (requestId === usersFetchSequence) {
            if (usersAbortController === abortController) {
                usersAbortController = null;
            }
            useDashboard.setState({ loading: false });
        }
    });
};
export const fetchInbounds = () => {
    const requestId = ++inboundsFetchSequence;
    inboundsAbortController?.abort();
    const abortController = new AbortController();
    inboundsAbortController = abortController;
    return fetch("/inbounds", { signal: abortController.signal })
        .then((inbounds) => {
        if (requestId !== inboundsFetchSequence ||
            abortController.signal.aborted) {
            return;
        }
        useDashboard.setState({
            inbounds: new Map(Object.entries(inbounds)),
        });
    })
        .catch((error) => {
        if (requestId !== inboundsFetchSequence ||
            abortController.signal.aborted ||
            isAbortError(error)) {
            return;
        }
        console.error("Failed to fetch inbounds:", error);
        useDashboard.setState({ inbounds: new Map() });
    })
        .finally(() => {
        if (requestId === inboundsFetchSequence) {
            if (inboundsAbortController === abortController) {
                inboundsAbortController = null;
            }
        }
    });
};
export const clearDashboardCache = () => {
    usersFetchSequence += 1;
    inboundsFetchSequence += 1;
    editingUserFetchSequence += 1;
    usersAbortController?.abort();
    inboundsAbortController?.abort();
    usersAbortController = null;
    inboundsAbortController = null;
    useDashboard.setState({
        users: createEmptyUsersResponse(),
        liveUserStats: {},
        linkTemplates: undefined,
        inbounds: new Map(),
        loading: false,
        isUserLimitReached: false,
        lastUsersFetchAt: null,
        usersCacheKey: null,
        usersCacheAuthToken: null,
        editingUser: null,
        editingUserInitialTab: null,
        quickEditUser: null,
        resetUsageUser: null,
        revokeSubscriptionUser: null,
        subscribeUrl: null,
        QRcodeLinks: null,
        qrCodeUsername: null,
        filters: createDefaultFilters(),
    });
};
export const useDashboard = create(subscribeWithSelector((set, get) => ({
    version: null,
    editingUser: null,
    editingUserInitialTab: null,
    quickEditUser: null,
    isCreatingNewUser: false,
    QRcodeLinks: null,
    qrCodeUsername: null,
    subscribeUrl: null,
    users: createEmptyUsersResponse(),
    liveUserStats: {},
    loading: true,
    isUserLimitReached: false,
    isResetingAllUsage: false,
    lastUsersFetchAt: null,
    usersCacheKey: null,
    usersCacheAuthToken: null,
    isEditingNodes: false,
    resetUsageUser: null,
    revokeSubscriptionUser: null,
    filters: createDefaultFilters(),
    inbounds: new Map(),
    isEditingCore: false,
    refetchUsers: (force = false) => {
        fetchUsers(get().filters, { force });
    },
    resetAllUsage: () => {
        return fetch(`/users/reset`, { method: "POST" }).then(() => {
            get().onResetAllUsage(false);
            get().refetchUsers(true);
        });
    },
    onResetAllUsage: (isResetingAllUsage) => set({ isResetingAllUsage }),
    onCreateUser: (isCreatingNewUser) => set({ isCreatingNewUser }),
    onEditingUser: (editingUser, initialTab) => {
        if (!editingUser) {
            editingUserFetchSequence += 1;
            set({ editingUser: null, editingUserInitialTab: null });
            return;
        }
        const requestId = ++editingUserFetchSequence;
        set({
            editingUser: editingUser,
            editingUserInitialTab: initialTab ?? null,
        });
        // Fetch full user detail before opening editor to keep list payload lightweight
        fetch(`/user/${editingUser.username}`)
            .then((fullUser) => {
            if (requestId !== editingUserFetchSequence)
                return;
            set({ editingUser: fullUser });
        })
            .catch(() => {
            if (requestId === editingUserFetchSequence) {
                set({ editingUser: null, editingUserInitialTab: null });
            }
        });
    },
    onFilterChange: (filters) => {
        set({
            filters: {
                ...get().filters,
                ...filters,
            },
        });
        get().refetchUsers(true);
    },
    setQRCode: (QRcodeLinks, qrCodeUsername = null) => {
        set({
            QRcodeLinks,
            qrCodeUsername: QRcodeLinks === null ? null : qrCodeUsername,
        });
    },
    deleteUser: (user) => {
        set({ editingUser: null });
        return fetch(`/user/${user.username}`, { method: "DELETE" }).then(() => {
            get().refetchUsers(true);
            queryClient.invalidateQueries(StatisticsQueryKey);
        });
    },
    createUser: (body) => {
        return fetch(`/user`, { method: "POST", body }).then(() => {
            set({ editingUser: null });
            get().refetchUsers(true);
            queryClient.invalidateQueries(StatisticsQueryKey);
        });
    },
    createUserWithService: (body) => {
        return fetch(`/v2/users`, { method: "POST", body }).then(() => {
            set({ editingUser: null });
            get().refetchUsers(true);
            queryClient.invalidateQueries(StatisticsQueryKey);
        });
    },
    editUser: (username, body) => {
        return fetch(`/v2/users/${username}`, { method: "PUT", body }).then(() => {
            get().onEditingUser(null);
            get().refetchUsers(true);
        });
    },
    fetchUserUsage: (body, query) => {
        const sanitizedQuery = Object.fromEntries(Object.entries(query).filter(([, value]) => Boolean(value)));
        return fetch(`/user/${body.username}/usage`, {
            method: "GET",
            query: sanitizedQuery,
        });
    },
    onEditingNodes: (isEditingNodes) => {
        set({ isEditingNodes });
    },
    setSubLink: (subscribeUrl) => {
        set({ subscribeUrl });
    },
    resetDataUsage: (user) => {
        return fetch(`/user/${user.username}/reset`, { method: "POST" }).then(() => {
            set({ resetUsageUser: null });
            get().refetchUsers(true);
        });
    },
    revokeSubscription: (user) => {
        return fetch(`/user/${user.username}/revoke_sub`, {
            method: "POST",
        }).then((user) => {
            set({ revokeSubscriptionUser: null, editingUser: user });
            get().refetchUsers(true);
        });
    },
    performBulkUserAction: (payload) => {
        return fetch(`/users/actions`, { method: "POST", body: payload }).then((response) => {
            get().refetchUsers(true);
            queryClient.invalidateQueries(StatisticsQueryKey);
            return response;
        });
    },
    onEditingCore: (isEditingCore) => set({ isEditingCore }),
})));
