const { performance } = require('perf_hooks');

const TOTAL_REQUESTS = 20;
const CONCURRENCY_LIMIT = 5;
const MIN_DELAY = 100;
const MAX_DELAY = 500;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Monitor for concurrency
let currentActiveRequests = 0;
let maxConcurrentRequests = 0;

const trackedFetch = async (id) => {
    currentActiveRequests++;
    if (currentActiveRequests > maxConcurrentRequests) {
        maxConcurrentRequests = currentActiveRequests;
    }

    // Simulate network delay
    const duration = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
    await delay(duration);

    currentActiveRequests--;
    return `Result ${id}`;
};

async function runBaseline() {
    console.log("Running Baseline (Promise.all)...");
    currentActiveRequests = 0;
    maxConcurrentRequests = 0;

    const tasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);

    const start = performance.now();
    await Promise.all(tasks.map(id => trackedFetch(id)));
    const end = performance.now();

    console.log(`Baseline Max Concurrency: ${maxConcurrentRequests}`);
    console.log(`Baseline Total Time: ${(end - start).toFixed(2)}ms`);
    return { max: maxConcurrentRequests, time: end - start };
}

async function runOptimized() {
    console.log("\nRunning Optimized (Concurrency Limit = 5)...");
    currentActiveRequests = 0;
    maxConcurrentRequests = 0;

    const tasks = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);
    const results = [];

    const start = performance.now();

    // Simple concurrency implementation for benchmark
    const executing = [];
    for (const item of tasks) {
        const p = trackedFetch(item).then(res => {
            // Remove from executing array when done
            executing.splice(executing.indexOf(p), 1);
            return res;
        });
        results.push(p);
        executing.push(p);

        if (executing.length >= CONCURRENCY_LIMIT) {
            await Promise.race(executing);
        }
    }
    await Promise.all(results);

    const end = performance.now();

    console.log(`Optimized Max Concurrency: ${maxConcurrentRequests}`);
    console.log(`Optimized Total Time: ${(end - start).toFixed(2)}ms`);
    return { max: maxConcurrentRequests, time: end - start };
}

(async () => {
    const baseline = await runBaseline();
    const optimized = await runOptimized();

    console.log("\n--- Comparison ---");
    console.log(`Concurrency Reduction: ${baseline.max} -> ${optimized.max}`);
    if (optimized.max <= CONCURRENCY_LIMIT) {
        console.log("SUCCESS: Concurrency limit respected.");
    } else {
        console.error("FAILURE: Concurrency limit exceeded.");
        process.exit(1);
    }
})();
