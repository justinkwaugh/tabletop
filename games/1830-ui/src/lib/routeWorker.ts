export function createRouteWorker(): Worker {
    return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
}
