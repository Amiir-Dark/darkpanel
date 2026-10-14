import { fetch as apiFetch } from "./http";
export const getSponsors = () => apiFetch("/sponsor");
