import { useSeasonal } from "contexts/SeasonalContext";
export const SeasonalOverlay = () => {
    const { isChristmas, shouldSnow } = useSeasonal();
    if (!isChristmas)
        return null;
    return <>{shouldSnow && <div className="rb-snow-layer" aria-hidden/>}</>;
};
