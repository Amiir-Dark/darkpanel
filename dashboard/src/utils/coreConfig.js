import { z } from "zod";
// Xray accepts extension keys, so the API boundary validates only its top-level shape.
export const coreConfigSchema = z.record(z.unknown());
export const parseCoreConfig = (value) => coreConfigSchema.parse(value);
