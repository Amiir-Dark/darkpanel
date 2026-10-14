import { PanelSelect, splitPanelSelectText, } from "./PanelSelect";
export const splitMultiValueText = splitPanelSelectText;
export const MultiValueAutocomplete = ({ allowCustom = true, emptyText, isDisabled = false, maxValues, options = [], placeholder, rightElement, value, onChange, }) => (<PanelSelect mode="multiple" allowCustom={allowCustom} isDisabled={isDisabled} emptyText={emptyText} options={options} placeholder={placeholder} rightElement={rightElement} value={value} onValueChange={(nextValue) => {
        if (!Array.isArray(nextValue)) {
            onChange(nextValue);
            return;
        }
        const values = maxValues && nextValue.length > maxValues
            ? nextValue.slice(-maxValues)
            : nextValue;
        onChange(values.join(", "));
    }}/>);
