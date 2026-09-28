import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AuditEvent } from "@/lib/api/types";

export function useAudit() {
	return useQuery({
		queryKey: ["audit"],
		queryFn: () => api<AuditEvent[]>("/audit"),
	});
}
