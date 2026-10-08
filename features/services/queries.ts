import { api } from "@/lib/api/client";
import type { ServiceCatalog } from "@/lib/api/types";

export const serviceKeys = { all: ["services"] as const };

/** Everything, hidden services and unpriced cells included (the dashboard's view). */
export const fetchServices = () => api<ServiceCatalog>("/services");
