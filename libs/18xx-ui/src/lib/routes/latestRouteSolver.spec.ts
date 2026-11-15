import { describe, expect, it } from 'vitest'
import type { AutoroutingResponse } from '@tabletop/18xx-autorouter'
import { minimalRailwayState } from '@tabletop/18xx/testing'
import { LatestRouteSolver, type RouteSolution } from './latestRouteSolver.js'
import { RouteSolveQueue } from './routeSolveQueue.js'

class FakeWorker extends EventTarget {
    posted: unknown[] = []
    terminated = false
    unclonable = false
    postMessage(message: unknown) {
        if (this.unclonable) throw new DOMException('Unclonable', 'DataCloneError')
        this.posted.push(message)
    }
    terminate() {
        this.terminated = true
    }
    answer(revenue: number) {
        const data: AutoroutingResponse = {
            result: {
                result: { companyId: 'R', routes: [], revenue },
                exhaustive: true,
                metrics: {
                    encodeMs: 0,
                    solveMs: 0,
                    validateMs: 0,
                    compileMs: 0,
                    pathMs: 0,
                    combinationMs: 0,
                    pathExhaustive: true,
                    combinationExhaustive: true,
                    memoryLimited: false,
                    memoryBytes: 0,
                    candidates: [],
                    expansions: 0,
                    connections: 0
                }
            }
        }
        this.dispatchEvent(new MessageEvent('message', { data }))
    }
    reject() {
        const data: AutoroutingResponse = { error: 'Company cannot run trains' }
        this.dispatchEvent(new MessageEvent('message', { data }))
    }
    fail() {
        this.dispatchEvent(new Event('error'))
    }
}

function request(name: string, key?: string) {
    return {
        state: { ...minimalRailwayState(), phaseId: name },
        companyId: 'R',
        name,
        ...(key ? { key } : {})
    }
}

function solver() {
    const workers: FakeWorker[] = []
    const solved: [string, number][] = []
    const failed: string[] = []
    const queue = new RouteSolveQueue(() => {
        const worker = new FakeWorker()
        workers.push(worker)
        return worker
    })
    const latest = new LatestRouteSolver<ReturnType<typeof request>>(queue, {
        solved: (solvedRequest, solution: RouteSolution) =>
            solved.push([solvedRequest.name, solution.result.revenue]),
        failed: (failedRequest) => failed.push(failedRequest.name)
    })
    return { latest, workers, solved, failed }
}

/** Lets the answers the workers gave reach their askers. */
const delivered = () => new Promise<void>((resolve) => setTimeout(resolve))

describe('LatestRouteSolver', () => {
    it('sends only the state, company and time limit of a request', async () => {
        const { latest, workers } = solver()
        const sent = request('a')
        latest.solve(sent)
        expect(workers[0].posted).toEqual([{ state: sent.state, companyId: 'R' }])
    })

    it("passes on a request's time limit", async () => {
        const { latest, workers } = solver()
        const sent = { ...request('a'), timeLimitMs: 1000 }
        latest.solve(sent)
        expect(workers[0].posted).toEqual([
            { state: sent.state, companyId: 'R', timeLimitMs: 1000 }
        ])
    })

    it('solves only the newest request made while one is in flight, on the same worker', async () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        latest.solve(request('b'))
        latest.solve(request('c'))
        workers[0].answer(10)
        await delivered()
        expect(solved).toEqual([['a', 10]])
        expect(workers).toHaveLength(1)
        expect(workers[0].posted).toHaveLength(2)
        workers[0].answer(30)
        await delivered()
        expect(solved).toEqual([
            ['a', 10],
            ['c', 30]
        ])
    })

    it('keeps its worker for later requests', async () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        workers[0].answer(10)
        await delivered()
        latest.solve(undefined)
        latest.solve(request('b'))
        workers[0].answer(20)
        await delivered()
        expect(workers).toHaveLength(1)
        expect(workers[0].terminated).toBe(false)
        expect(solved).toEqual([
            ['a', 10],
            ['b', 20]
        ])
    })

    it('sends nothing more once requests stop', async () => {
        const { latest, workers } = solver()
        latest.solve(request('a'))
        latest.solve(undefined)
        workers[0].answer(10)
        await delivered()
        expect(workers[0].posted).toHaveLength(1)
    })

    it('reports a request the router could not solve', async () => {
        const { latest, workers, failed } = solver()
        latest.solve(request('a'))
        workers[0].reject()
        await delivered()
        expect(failed).toEqual(['a'])
        expect(workers[0].terminated).toBe(false)
    })

    it('replaces a failed worker and sends the request waiting on it', async () => {
        const { latest, workers, solved, failed } = solver()
        latest.solve(request('a'))
        latest.solve(request('b'))
        workers[0].fail()
        await delivered()
        expect(workers[0].terminated).toBe(true)
        expect(failed).toEqual(['a'])
        workers[1].answer(20)
        await delivered()
        expect(solved).toEqual([['b', 20]])
    })

    it('reports a request that cannot be sent', async () => {
        const { latest, workers, solved, failed } = solver()
        latest.solve(request('a'))
        workers[0].answer(10)
        await delivered()
        workers[0].unclonable = true
        latest.solve(request('b'))
        await delivered()
        expect(failed).toEqual(['b'])
        workers[0].unclonable = false
        latest.solve(request('c'))
        workers[0].answer(30)
        await delivered()
        expect(solved.at(-1)).toEqual(['c', 30])
        expect(workers).toHaveLength(1)
    })

    it('answers a request with the key of an earlier answer without solving it', async () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a', 'network-1'))
        workers[0].answer(10)
        await delivered()
        latest.solve(request('b', 'network-2'))
        workers[0].answer(20)
        await delivered()
        latest.solve(request('c', 'network-1'))
        expect(solved).toEqual([
            ['a', 10],
            ['b', 20],
            ['c', 10]
        ])
        expect(workers[0].posted).toHaveLength(2)
    })

    it('does not show an answer overtaken by a remembered one, but keeps it', async () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a', 'network-1'))
        workers[0].answer(10)
        await delivered()
        latest.solve(request('b', 'network-2'))
        latest.solve(request('c', 'network-1'))
        workers[0].answer(20)
        await delivered()
        expect(solved).toEqual([
            ['a', 10],
            ['c', 10]
        ])
        expect(workers[0].posted).toHaveLength(2)
        latest.solve(request('d', 'network-2'))
        expect(solved.at(-1)).toEqual(['d', 20])
    })

    it('forgets the oldest answers beyond the most recent 64', async () => {
        const { latest, workers, solved } = solver()
        for (let index = 0; index <= 64; index++) {
            latest.solve(request(String(index), `network-${index}`))
            workers[0].answer(index)
            await delivered()
        }
        latest.solve(request('again', 'network-1'))
        expect(solved.at(-1)).toEqual(['again', 1])
        latest.solve(request('first', 'network-0'))
        expect(workers[0].posted).toHaveLength(66)
    })

    it('reports nothing once destroyed, leaving the worker to its other askers', async () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        latest.destroy()
        workers[0].answer(10)
        await delivered()
        expect(workers[0].terminated).toBe(false)
        expect(solved).toEqual([])
    })
})
