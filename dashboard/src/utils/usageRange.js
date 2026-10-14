import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
export const buildRangeFromPreset = (preset) => {
    const alignUnit = preset.unit === "hour" ? "hour" : "day";
    const end = dayjs().utc().endOf(alignUnit);
    const span = Math.max(preset.amount - 1, 0);
    const start = end.subtract(span, preset.unit).startOf(alignUnit);
    return {
        key: preset.key,
        start: start.toDate(),
        end: end.toDate(),
        unit: preset.unit,
    };
};
export const normalizeCustomRange = (start, end) => {
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const [minDate, maxDate] = startDate.isBefore(endDate)
        ? [startDate, endDate]
        : [endDate, startDate];
    const startAligned = minDate.startOf("day");
    const endAligned = maxDate.endOf("day");
    const isSingleDay = startAligned.isSame(endAligned, "day");
    return {
        key: "custom",
        start: startAligned.toDate(),
        end: endAligned.toDate(),
        unit: isSingleDay ? "hour" : "day",
    };
};
