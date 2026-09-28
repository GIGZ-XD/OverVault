import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { FileSummary } from "@/lib/api/types";

export function useFiles() {
	return useQuery({
		queryKey: ["files"],
		queryFn: () => api<FileSummary[]>("/files"),
	});
}
