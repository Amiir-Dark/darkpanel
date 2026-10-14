import { AdminRole, AdminTrafficLimitMode } from "types/Admin";
export const usesCreatedTrafficLimit = (admin) => Boolean(admin &&
    admin.role !== AdminRole.FullAccess &&
    !admin.use_service_traffic_limits &&
    admin.traffic_limit_mode === AdminTrafficLimitMode.CreatedTraffic);
const getServiceLimit = (admin, serviceId) => (admin?.service_limits ?? []).find((item) => item.service_id === serviceId) ??
    null;
export const getAdminTrafficScope = (admin, serviceId) => {
    if (!admin)
        return null;
    if (admin.use_service_traffic_limits) {
        return getServiceLimit(admin, serviceId);
    }
    return admin;
};
export const canViewUserTraffic = (admin, serviceId) => {
    if (!admin)
        return true;
    if (admin.role === AdminRole.FullAccess)
        return true;
    if (admin.use_service_traffic_limits) {
        const serviceLimit = getServiceLimit(admin, serviceId);
        if (!serviceLimit)
            return true;
        if (serviceLimit.traffic_limit_mode !== AdminTrafficLimitMode.CreatedTraffic) {
            return true;
        }
        return serviceLimit.show_user_traffic !== false;
    }
    if (!usesCreatedTrafficLimit(admin))
        return true;
    return admin.show_user_traffic !== false;
};
export const isUserManagementLocked = (admin, serviceId) => {
    if (!admin)
        return false;
    if (admin.role === AdminRole.FullAccess)
        return false;
    if (admin.use_service_traffic_limits) {
        const scope = getServiceLimit(admin, serviceId);
        const limit = scope?.data_limit ?? null;
        if (!scope || limit === null || limit === undefined || limit <= 0) {
            return false;
        }
        const usage = scope.traffic_limit_mode === AdminTrafficLimitMode.CreatedTraffic
            ? scope.created_traffic
            : scope.used_traffic;
        return (usage ?? 0) >= limit;
    }
    if (!usesCreatedTrafficLimit(admin))
        return false;
    const limit = admin.data_limit ?? null;
    if (limit === null || limit === undefined || limit <= 0)
        return false;
    return (admin.created_traffic ?? 0) >= limit;
};
export const canDeleteUserByTrafficCap = (admin, user) => {
    if (!admin || admin.role === AdminRole.FullAccess || !user)
        return true;
    const serviceLimit = admin.use_service_traffic_limits
        ? getServiceLimit(admin, user.service_id)
        : null;
    const scope = serviceLimit ?? admin;
    if (scope.traffic_limit_mode !== AdminTrafficLimitMode.CreatedTraffic) {
        return true;
    }
    if (!scope.delete_user_usage_limit_enabled) {
        if (serviceLimit) {
            const limit = serviceLimit.data_limit ?? null;
            if (limit && limit > 0) {
                return (serviceLimit.created_traffic ?? 0) < limit;
            }
        }
        return !isUserManagementLocked(admin);
    }
    const limit = scope.delete_user_usage_limit ?? 0;
    return (user.used_traffic ?? 0) <= limit;
};
