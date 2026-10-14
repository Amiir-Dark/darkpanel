import { NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, } from "@chakra-ui/react";
export const NumericInput = ({ fieldProps, fieldRef, min = 0, step = 1, defaultValue = 0, ...props }) => {
    const fieldPaddingRight = fieldProps?.pr ?? fieldProps?.paddingRight ?? "2rem";
    return (<NumberInput keepWithinRange min={min} step={step} defaultValue={props.value === undefined ? defaultValue : undefined} role="group" {...props} sx={{
            "@media (hover: none)": {
                ".rb-number-stepper": {
                    opacity: 1,
                    pointerEvents: "auto",
                },
            },
            ...props.sx,
        }}>
			<NumberInputField ref={fieldRef} inputMode="decimal" {...fieldProps} pr={fieldPaddingRight}/>
			<NumberInputStepper className="rb-number-stepper" opacity={0} pointerEvents="none" transition="opacity 0.15s ease" _groupHover={{ opacity: 1, pointerEvents: "auto" }} _groupFocusWithin={{ opacity: 1, pointerEvents: "auto" }}>
				<NumberIncrementStepper />
				<NumberDecrementStepper />
			</NumberInputStepper>
		</NumberInput>);
};
