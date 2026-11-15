import * as Flags from "country-flag-icons/react/3x2";
import { Fragment, memo, useMemo, useState } from "react";
const APPLE_EMOJI_BASE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const failedSources = new Set();
const resolvedSources = new Map();

const getCountryCodeFromFlag = (value) => {
    const cps = Array.from(value, (ch) => ch.codePointAt(0) ?? 0);
    if (cps.length !== 2)
        return null;
    if (cps[0] < 0x1f1e6 || cps[0] > 0x1f1ff || cps[1] < 0x1f1e6 || cps[1] > 0x1f1ff)
        return null;
    return String.fromCharCode(cps[0] - 0x1f1e6 + 65, cps[1] - 0x1f1e6 + 65);
};
const toCodePoint = (value) => Array.from(value, (character) => character.codePointAt(0)?.toString(16) ?? "")
    .filter(Boolean)
    .filter((codePoint) => codePoint !== "fe0e");
const getSources = (value) => {
    const codePoints = toCodePoint(value);
    const full = codePoints.join("-");
    const withoutVariant = codePoints
        .filter((codePoint) => codePoint !== "fe0f")
        .join("-");
    const isSequence = codePoints.includes("200d") || codePoints.includes("20e3");
    const names = isSequence
        ? [full, withoutVariant]
        : EMOJI_PRESENTATION.test(value)
            ? [withoutVariant, full]
            : [`${withoutVariant}-fe0f`, full, withoutVariant];
    const sources = names
        .filter((name, index) => name && names.indexOf(name) === index)
        .map((name) => `${APPLE_EMOJI_BASE}${name}.png`);
    const resolved = resolvedSources.get(value);
    return [resolved, ...sources].filter((source, index, all) => typeof source === "string" &&
        all.indexOf(source) === index &&
        !failedSources.has(source));
};
const AppleEmojiGlyph = memo(({ value }) => {
    const countryCode = useMemo(() => getCountryCodeFromFlag(value), [value]);
    const FlagIcon = countryCode ? Flags[countryCode] : null;
    const sources = useMemo(() => (FlagIcon ? [] : getSources(value)), [FlagIcon, value]);
    const [sourceIndex, setSourceIndex] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    if (FlagIcon) {
        return (<span className="inline-flex items-center align-middle mx-[0.1em]" role="img" aria-label={value}>
				<FlagIcon className="h-[0.95em] w-[1.35em] rounded-[2px] shadow-xs"/>
			</span>);
    }
    const source = sources[sourceIndex];
    return (<span className="apple-emoji-glyph" data-loaded={isLoaded || undefined} role="img" aria-label={value}>
			<span className="apple-emoji-native" aria-hidden="true">
				{value}
			</span>
			{source && (<img className="apple-emoji" src={source} alt="" aria-hidden="true" draggable={false} decoding="async" onLoad={() => {
                resolvedSources.set(value, source);
                setIsLoaded(true);
            }} onError={() => {
                failedSources.add(source);
                if (resolvedSources.get(value) === source) {
                    resolvedSources.delete(value);
                }
                setIsLoaded(false);
                setSourceIndex((index) => index + 1);
            }}/>)}
		</span>);
});
export const AppleEmojiText = memo(({ children }) => {
    const segments = useMemo(() => {
        if (typeof children !== "string" || !EMOJI_GRAPHEME.test(children))
            return null;
        return Array.from(segmenter.segment(children), ({ index, segment }) => ({
            key: `${index}-${segment}`,
            segment,
        }));
    }, [children]);
    if (!segments)
        return <>{children}</>;
    return (<>
			{segments.map(({ key, segment }) => EMOJI_GRAPHEME.test(segment) ? (<AppleEmojiGlyph key={key} value={segment}/>) : (<Fragment key={key}>{segment}</Fragment>))}
		</>);
});
