/// <reference lib="webworker" />

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
