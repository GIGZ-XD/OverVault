export type Verification = "verified" | "pending" | "tampered";

export interface AuditEvent {
	id: string;
	event_type: string;
	file_id: string;
	actor: string;
	tx_hash: string | null;
	verification: Verification;
	timestamp: number;
}

export interface FileSummary {
	id: string;
	name: string;
	owner: string;
	size: number;
	protection: string;
	verification: Verification;
	hash: string;
	ownership_tx: string | null;
}
