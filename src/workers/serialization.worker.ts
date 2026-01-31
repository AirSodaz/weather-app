/// <reference lib="webworker" />

type WorkerMessage =
    | { id: number; type: 'stringify'; data: any }
    | { id: number; type: 'parse'; data: string };

/**
 * Handles messages sent to the worker.
 * Serializes/Deserializes data to/from JSON and sends it back to the main thread.
 *
 * @param {MessageEvent} e - The message event containing the data and action type.
 */
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { id, type, data } = e.data;

    try {
        let result: any;

        if (type === 'stringify') {
            result = JSON.stringify(data);
        } else if (type === 'parse') {
            result = JSON.parse(data as string);
        } else {
            // Fallback for backward compatibility or default behavior (stringify)
            // if type is missing (though we should update caller).
            // Assuming old format was { id, data } -> stringify.
            if (!type && typeof data !== 'undefined') {
                 result = JSON.stringify(data);
            } else {
                throw new Error(`Unknown action type: ${type}`);
            }
        }

        self.postMessage({ id, result, success: true });
    } catch (err) {
        self.postMessage({
            id,
            error: err instanceof Error ? err.message : String(err),
            success: false
        });
    }
};
