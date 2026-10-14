export const DEFAULT_SEARCH_MATCH_OPTIONS = {
    matchCase: false,
    matchWholeWord: false,
};
const normalizeCase = (value, matchCase) => matchCase ? value : value.toLocaleLowerCase();
const normalizeWords = (value) => value
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
export const matchesSearch = (value, query, options = DEFAULT_SEARCH_MATCH_OPTIONS) => {
    const needle = query.trim();
    if (!needle)
        return true;
    const text = String(value ?? "");
    if (!options.matchWholeWord) {
        return normalizeCase(text, options.matchCase).includes(normalizeCase(needle, options.matchCase));
    }
    const normalizedNeedle = normalizeWords(needle);
    if (!normalizedNeedle)
        return false;
    return normalizeCase(` ${normalizeWords(text)} `, options.matchCase).includes(normalizeCase(` ${normalizedNeedle} `, options.matchCase));
};
export const matchesAnySearch = (values, query, options = DEFAULT_SEARCH_MATCH_OPTIONS) => !query.trim() || values.some((value) => matchesSearch(value, query, options));
export const addSearchMatchQuery = (params, options) => {
    if (options.matchCase)
        params.set("match_case", "true");
    if (options.matchWholeWord)
        params.set("match_whole_word", "true");
};
