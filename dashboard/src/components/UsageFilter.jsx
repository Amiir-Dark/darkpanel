import { Box, } from "@chakra-ui/react";
import { DateRangePicker, } from "components/common/DateRangePicker";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { generateDistinctColors } from "utils/color";
import { formatBytes } from "utils/formatByte";
const usagePresets = [
    { key: "7h", label: "7h", amount: 7, unit: "hour" },
    { key: "1d", label: "1d", amount: 1, unit: "day" },
    { key: "3d", label: "3d", amount: 3, unit: "day" },
    { key: "1w", label: "1w", amount: 1, unit: "week" },
    { key: "1m", label: "1m", amount: 1, unit: "month" },
    { key: "3m", label: "3m", amount: 3, unit: "month" },
];
const parseRangeKey = (value) => {
    const num = Number(value.substring(0, value.length - 1));
    const unitBySuffix = {
        h: "hour",
        d: "day",
        w: "week",
        m: "month",
        y: "year",
    };
    const unit = unitBySuffix[value[value.length - 1]];
    return Number.isFinite(num) && unit ? { num, unit } : null;
};
const buildRangeFromKey = (value) => {
    const parsed = parseRangeKey(value);
    const unit = parsed?.unit ?? "month";
    const amount = parsed?.num ?? 1;
    const alignUnit = unit === "hour" ? "hour" : "day";
    const end = dayjs().utc().endOf(alignUnit).toDate();
    const span = Math.max(amount - 1, 0);
    const start = dayjs()
        .utc()
        .subtract(span, unit)
        .startOf(alignUnit)
        .toDate();
    return {
        start,
        end,
        presetKey: value,
        key: value,
        unit: unit === "hour" ? "hour" : "day",
    };
};
const toFilterQuery = (value) => ({
    start: dayjs(value.start).utc().format("YYYY-MM-DDTHH:mm:ss"),
    end: dayjs(value.end).utc().format("YYYY-MM-DDTHH:mm:ss"),
});
export const UsageFilter = ({ onChange, defaultValue, ...props }) => {
    const initialRange = useMemo(() => buildRangeFromKey(defaultValue || "1m"), [defaultValue]);
    const [range, setRange] = useState(initialRange);
    return (<Box {...props}>
			<DateRangePicker value={range} presets={usagePresets} defaultPreset={defaultValue || "1m"} onChange={(nextRange) => {
            setRange(nextRange);
            onChange(nextRange.key || nextRange.presetKey || "custom", toFilterQuery(nextRange));
        }}/>
		</Box>);
};
export function createUsageConfig(colorMode, title, series = [], labels = []) {
    const total = formatBytes(series.reduce((t, c) => t + c, 0));
    return {
        series: series,
        options: {
            labels: labels,
            chart: {
                width: "100%",
                height: "100%",
                type: "donut",
                animations: {
                    enabled: false,
                },
            },
            title: {
                text: `${title}${total}`,
                align: "center",
                style: {
                    fontWeight: "var(--chakra-fontWeights-medium)",
                    color: colorMode === "dark" ? "var(--chakra-colors-gray-300)" : undefined,
                },
            },
            legend: {
                position: "bottom",
                labels: {
                    colors: colorMode === "dark" ? "#CBD5E0" : undefined,
                    useSeriesColors: false,
                },
            },
            stroke: {
                width: 1,
                colors: undefined,
            },
            dataLabels: {
                formatter: (_val, { seriesIndex, w }) => {
                    return formatBytes(w.config.series[seriesIndex], 1);
                },
            },
            tooltip: {
                custom: ({ series, seriesIndex, w }) => {
                    const readable = formatBytes(series[seriesIndex], 1);
                    const total = Math.max(series.reduce((t, c) => t + c, 0), 1);
                    const percent = `${Math.round((series[seriesIndex] / total) * 1000) / 10}%`;
                    return `
            <div style="
                    background-color: ${w.globals.colors[seriesIndex]};
                    padding-left:12px;
                    padding-right:12px;
                    padding-top:6px;
                    padding-bottom:6px;
                    font-size:0.725rem;
                  "
            >
              ${w.config.labels[seriesIndex]}: <b>${percent}, ${readable}</b>
            </div>
          `;
                },
            },
            colors: generateDistinctColors(series.length),
        },
    };
}
