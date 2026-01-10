/// <reference types="vite/client" />

interface Window {
    store: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
        delete: (key: string) => Promise<void>;
    };
    windowControls?: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
    };
}
