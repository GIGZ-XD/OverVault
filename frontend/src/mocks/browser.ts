import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

let workerStartPromise: Promise<void> | undefined;

export function startMockWorker(): Promise<void> {
	if (!workerStartPromise) {
		workerStartPromise = Promise.resolve(
			worker.start({ onUnhandledRequest: "bypass" })
		).then(() => undefined);
	}
	return workerStartPromise;
}
