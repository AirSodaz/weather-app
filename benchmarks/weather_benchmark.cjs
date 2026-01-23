const { performance } = require('perf_hooks');

// --- Original Implementation ---
const getWeatherBackgroundOriginal = (condition) => {
    const c = condition.toLowerCase();
    if (c.includes('sunny') || c.includes('clear') || c.includes('晴')) return 'bg-sunny';
    if (c.includes('rain') || c.includes('drizzle') || c.includes('thunder') || c.includes('雨') || c.includes('雷')) return 'bg-rainy';
    if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard') || c.includes('雪') || c.includes('冰')) return 'bg-snowy';
    if (c.includes('cloud') || c.includes('overcast') || c.includes('云') || c.includes('阴')) return 'bg-cloudy';
    return 'bg-default';
};

// --- Optimized Implementation ---
const SUNNY_REGEX = /sunny|clear|晴/i;
const RAINY_REGEX = /rain|drizzle|thunder|雨|雷/i;
const SNOWY_REGEX = /snow|sleet|blizzard|雪|冰/i;
const CLOUDY_REGEX = /cloud|overcast|云|阴/i;

const getWeatherBackgroundOptimized = (condition) => {
    if (SUNNY_REGEX.test(condition)) return 'bg-sunny';
    if (RAINY_REGEX.test(condition)) return 'bg-rainy';
    if (SNOWY_REGEX.test(condition)) return 'bg-snowy';
    if (CLOUDY_REGEX.test(condition)) return 'bg-cloudy';
    return 'bg-default';
};

// --- Test Data ---
const testCases = [
    "Sunny", "Clear Sky", "Partly Sunny", "晴", // Sunny
    "Heavy Rain", "Drizzle", "Thunderstorm", "雷雨", // Rainy
    "Snow", "Sleet showers", "Blizzard conditions", "大雪", // Snowy
    "Cloudy", "Overcast", "Partly Cloudy", "多云", // Cloudy
    "Mist", "Fog", "Haze", "Unknown" // Default
];

// Verify correctness
console.log("Verifying correctness...");
let errors = 0;
for (const condition of testCases) {
    const original = getWeatherBackgroundOriginal(condition);
    const optimized = getWeatherBackgroundOptimized(condition);
    if (original !== optimized) {
        console.error(`Mismatch for '${condition}': Original=${original}, Optimized=${optimized}`);
        errors++;
    }
}
if (errors === 0) {
    console.log("Correctness verified. All outputs match.");
} else {
    console.error(`Found ${errors} mismatches. Aborting benchmark.`);
    process.exit(1);
}

// --- Benchmark ---
const ITERATIONS = 1_000_000;

console.log(`\nRunning benchmark with ${ITERATIONS} iterations per implementation...`);

// Measure Original
const startOriginal = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    for (const condition of testCases) {
        getWeatherBackgroundOriginal(condition);
    }
}
const endOriginal = performance.now();
const timeOriginal = endOriginal - startOriginal;

// Measure Optimized
const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    for (const condition of testCases) {
        getWeatherBackgroundOptimized(condition);
    }
}
const endOptimized = performance.now();
const timeOptimized = endOptimized - startOptimized;

// Results
console.log("\n--- Results ---");
console.log(`Original:  ${timeOriginal.toFixed(2)} ms`);
console.log(`Optimized: ${timeOptimized.toFixed(2)} ms`);
console.log(`Improvement: ${(timeOriginal / timeOptimized).toFixed(2)}x faster`);
