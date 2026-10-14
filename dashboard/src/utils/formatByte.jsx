export function formatBytes(bytes, decimals = 2, asArray = false) {
    if (!+bytes) {
        const zeroResult = [0, "B"];
        return asArray ? zeroResult : `${zeroResult[0]} ${zeroResult[1]}`;
    }
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / k ** i).toFixed(dm));
    if (!asArray) {
        return `${value} ${sizes[i]}`;
    }
    return [value, sizes[i]];
}
export const numberWithCommas = (x) => {
    if (x === null || x === undefined || Number.isNaN(Number(x)))
        return "0";
    return Number(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
