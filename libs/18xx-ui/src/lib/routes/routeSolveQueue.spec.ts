import { describe, expect, it } from 'vitest'
import { minimalPlayState } from '@tabletop/18xx/testing'
import type { AutoroutingRequest } from '@tabletop/18xx-autorouter'
import { RouteSolveQueue, type QueuedRouteWorker } from './routeSolveQueue.js'

const request: AutoroutingRequest = { state: minimalState(), companyId: 'R' }
function minimalState(): AutoroutingRequest['state'] {
    return structuredClone(minimalPlayState())
}

class FakeWorker extends EventTarget implements QueuedRouteWorker {
    terminated = false
    asked = 0
    postMessage() {
        this.asked++
    }
    terminate() {
        this.terminated = true
    }
}

describe('RouteSolveQueue', () => {
    it('starts one worker when warmed and uses it for the first request', () => {
        const workers: FakeWorker[] = []
        const queue = new RouteSolveQueue(() => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        })
        queue.warm()
        queue.warm()
        expect(workers).toHaveLength(1)
        void queue.solve(request)
        return Promise.resolve().then(() => {
            expect(workers).toHaveLength(1)
            expect(workers[0].asked).toBe(1)
        })
    })

    it('replaces a warmed worker that failed before its first request', async () => {
        const workers: FakeWorker[] = []
        const queue = new RouteSolveQueue(() => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        })
        queue.warm()
        workers[0].dispatchEvent(new Event('error'))
        expect(workers[0].terminated).toBe(true)
        const answer = queue.solve(request)
        await Promise.resolve()
        expect(workers).toHaveLength(2)
        workers[1].dispatchEvent(new Event('error'))
        await expect(answer).resolves.toEqual({ error: 'The route solver could not finish.' })
    })

    it('keeps its worker from one answer to the next request', async () => {
        const workers: FakeWorker[] = []
        const queue = new RouteSolveQueue(() => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        })
        const first = queue.solve(request)
        workers[0].dispatchEvent(new MessageEvent('message', { data: { error: 'first' } }))
        await expect(first).resolves.toEqual({ error: 'first' })
        const second = queue.solve(request)
        workers[0].dispatchEvent(new MessageEvent('message', { data: { error: 'second' } }))
        await expect(second).resolves.toEqual({ error: 'second' })
        expect(workers).toHaveLength(1)
        expect(workers[0].terminated).toBe(false)
    })

    it('drops a cancelled request that was still waiting, keeping the worker', async () => {
        const workers: FakeWorker[] = []
        const queue = new RouteSolveQueue(() => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        })
        const searching = queue.solve(request)
        const waiting = queue.ask(request)
        waiting.cancel()
        await expect(waiting.answer).resolves.toEqual({
            error: 'The route calculation was cancelled.'
        })
        workers[0].dispatchEvent(new MessageEvent('message', { data: { error: 'first' } }))
        await expect(searching).resolves.toEqual({ error: 'first' })
        expect(workers[0].asked).toBe(1)
        expect(workers[0].terminated).toBe(false)
    })

    it('stops a search under way with its worker and answers the next on a new one', async () => {
        const workers: FakeWorker[] = []
        const queue = new RouteSolveQueue(() => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        })
        const searching = queue.ask(request)
        const next = queue.solve(request)
        searching.cancel()
        expect(workers[0].terminated).toBe(true)
        expect(workers).toHaveLength(2)
        workers[1].dispatchEvent(new MessageEvent('message', { data: { error: 'next' } }))
        await expect(next).resolves.toEqual({ error: 'next' })
        searching.cancel()
        expect(workers[1].terminated).toBe(false)
    })

    it('does not throw when warmed where no worker can start', () => {
        const queue = new RouteSolveQueue(() => {
            throw new Error('No workers here')
        })
        expect(() => queue.warm()).not.toThrow()
    })
})
