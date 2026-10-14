import { forwardRef } from "react";
import ReactDatePicker from "react-datepicker";
const DatePicker = forwardRef((props, ref) => (<ReactDatePicker {...props} ref={ref}/>));
DatePicker.displayName = "DatePicker";
export default DatePicker;
