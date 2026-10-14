import dayjs from "dayjs";
export const addQuickExpiry = (value, amount, unit) => (value ? dayjs(value) : dayjs()).add(amount, unit).endOf("day").toDate();
