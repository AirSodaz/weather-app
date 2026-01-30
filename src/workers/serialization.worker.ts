/// <reference lib="webworker" />

/**
 * Handles messages sent to the worker.
 * Serializes the provided data to JSON and sends it back to the main thread.
 *
 * @param {MessageEvent} e - The message event containing the data to serialize.
 * @param {any} e.data.data - The data to be stringified.
 * @param {number} e.data.id - The unique identifier for the request.
 */
self.onmessage = (e: MessageEvent) => {
    const { id, data } = e.data;

    try {
        const json = JSON.stringify(data);
        self.postMessage({ id, json, success: true });
    } catch (err) {
        self.postMessage({
            id,
            error: err instanceof Error ? err.message : String(err),
            success: false
        });
    }
};
