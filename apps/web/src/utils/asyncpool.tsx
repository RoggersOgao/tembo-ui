/**
 * Run promises with concurrency limit
 * @param poolLimit Maximum number of concurrent promises
 * @param array Array of items to process
 * @param iteratorFn Function to execute for each item
 */
export async function asyncPool<T>(
    poolLimit: number,
    array: T[],
    iteratorFn: (item: T) => Promise<any>
) {
    const ret = [];
    const executing: Promise<any>[] = [];

    for (const item of array) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        ret.push(p);

        if (poolLimit <= array.length) {
            const e: Promise<any> = p.then(() =>
                executing.splice(executing.indexOf(e), 1)
            );
            executing.push(e);

            if (executing.length >= poolLimit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(ret);
}