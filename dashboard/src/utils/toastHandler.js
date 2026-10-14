import { getAPIErrorMessage } from "service/http";
const asRecord = (value) => value && typeof value === "object" ? value : undefined;
const firstErrorText = (...values) => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
        const record = asRecord(value);
        if (!record)
            continue;
        for (const key of [
            "message",
            "error",
            "detail",
            "title",
            "statusMessage",
            "statusText",
        ]) {
            const text = record[key];
            if (typeof text === "string" && text.trim()) {
                return text.trim();
            }
        }
    }
    return undefined;
};
const getErrorMessage = (error) => {
    const errorRecord = asRecord(error);
    const response = asRecord(errorRecord?.response);
    const body = response?._data ?? response?.data;
    return firstErrorText(error, body, response);
};
export const generateErrorMessage = (e, toast, form) => {
    const errorRecord = asRecord(e);
    const response = asRecord(errorRecord?.response);
    const detail = asRecord(response?._data ?? response?.data)?.detail;
    if (detail && typeof detail === "object" && form) {
        const validationDetail = detail;
        if (Object.keys(validationDetail).length > 0) {
            Object.keys(validationDetail).forEach((errorKey) => {
                form.setError(errorKey, {
                    message: validationDetail[errorKey],
                });
            });
            return;
        }
    }
    const validationMessage = detail && typeof detail === "object"
        ? Object.entries(detail)
            .map(([key, value]) => typeof value === "string" ? `${key}: ${value}` : "")
            .filter(Boolean)
            .join(", ")
        : undefined;
    const message = validationMessage || getAPIErrorMessage(e) || getErrorMessage(e);
    const status = response?.status;
    return toast({
        title: message ??
            (typeof status === "number"
                ? `Request failed (HTTP ${status})`
                : "Request failed"),
        status: "error",
        isClosable: true,
        position: "top",
        duration: 3000,
    });
};
export const generateSuccessMessage = (message, toast) => {
    return toast({
        title: message,
        status: "success",
        isClosable: true,
        position: "top",
        duration: 3000,
    });
};
