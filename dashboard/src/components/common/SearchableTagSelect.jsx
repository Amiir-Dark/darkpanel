import { PanelSelect } from "./PanelSelect";
const normalizeOption = (option) => {
    if (typeof option === "string") {
        return {
            label: option,
            title: option,
            value: option,
        };
    }
    return {
        disabled: option.disabled,
        label: option.label || option.title || option.value,
        title: option.title || option.label || option.value,
        value: option.value,
    };
};
export const SearchableTagSelect = ({ emptyText = "No options found", isDisabled = false, mode = "single", onChange, options, placeholder, rightElement, searchPlaceholder = "Search", size = "sm", value, width, }) => (<PanelSelect mode={mode} value={value} options={options.map(normalizeOption)} placeholder={placeholder} rightElement={rightElement} searchPlaceholder={searchPlaceholder} emptyText={emptyText} isDisabled={isDisabled} size={size} width={width} onValueChange={onChange}/>);
