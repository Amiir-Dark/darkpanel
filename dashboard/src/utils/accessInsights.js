export const filterAccessInsightItems = (items, filters) => items.filter((item) => (!filters.protocol ||
    item.platforms.some((platform) => platform.platform === filters.protocol)) &&
    (!filters.node || item.nodes?.includes(filters.node)));
