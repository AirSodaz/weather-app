
/**
 * Processes an array of items with a concurrency limit.
 * 
 * @param items Array of items to process
 * @param iteratorFn Function to process each item. Should return a Promise.
 * @param concurrencyLimit Maximum number of concurrent promises (default: 5)
 * @param onProgress Optional callback executed when an item completes.
 * @returns Promise that resolves to an array of results in the same order as items.
 */
export async function processWithConcurrency<T, R>(
    items: T[],
    iteratorFn: (item: T, index: number) => Promise<R>,
    concurrencyLimit: number = 5,
    onProgress?: (result: R, index: number) => void
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const executing: Promise<void>[] = [];
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Create the promise for the task
        // We wrap the iteratorFn to handle the result storage and progress callback
        const p = iteratorFn(item, i).then(result => {
            results[i] = result;
            if (onProgress) {
                onProgress(result, i);
            }
            return result;
        });

        // We wrap p again to create a promise that removes itself from the executing list when done
        // We cast to 'any' to avoid TS strict checks on splice for promises, 
        // though strictly we should track IDs.
        // But since we are modifying the array we are iterating (in Promise.race), we need a stable reference.
        
        // Correct approach:
        const e: Promise<void> = p.then(() => {
            // Remove 'e' from executing
            const idx = executing.indexOf(e);
            if (idx !== -1) {
                executing.splice(idx, 1);
            }
        });
        
        executing.push(e);
        
        if (executing.length >= concurrencyLimit) {
            await Promise.race(executing);
        }
    }
    
    // Wait for remaining tasks
    await Promise.all(executing);
    
    return results;
}
