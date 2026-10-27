import { describe, expect, it } from 'vitest'
import type { AutoroutingResponse } from '@tabletop/18xx-autorouter'
import { minimalRailwayState } from '@tabletop/18xx/testing'
import { LatestRouteSolver, type RouteSolution } from './latestRouteSolver.js'

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

function request(name: string) {
    return { state: { ...minimalRailwayState(), phaseId: name }, companyId: 'R', name }
}

function solver() {
    const workers: FakeWorker[] = []
    const solved: [string, number][] = []
    const failed: string[] = []
    const latest = new LatestRouteSolver<ReturnType<typeof request>>(
        () => {
            const worker = new FakeWorker()
            workers.push(worker)
            return worker
        },
        {
            solved: (solvedRequest, solution: RouteSolution) =>
                solved.push([solvedRequest.name, solution.result.revenue]),
            failed: (failedRequest) => failed.push(failedRequest.name)
        }
    )
    return { latest, workers, solved, failed }
}

describe('LatestRouteSolver', () => {
    it('sends only the state and company of a request', () => {
        const { latest, workers } = solver()
        const sent = request('a')
        latest.solve(sent)
        expect(workers[0].posted).toEqual([{ state: sent.state, companyId: 'R' }])
    })

    it('solves only the newest request made while one is in flight, on the same worker', () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        latest.solve(request('b'))
        latest.solve(request('c'))
        workers[0].answer(10)
        expect(solved).toEqual([['a', 10]])
        expect(workers).toHaveLength(1)
        expect(workers[0].posted).toHaveLength(2)
        workers[0].answer(30)
        expect(solved).toEqual([
            ['a', 10],
            ['c', 30]
        ])
    })

    it('keeps its worker for later requests', () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        workers[0].answer(10)
        latest.solve(undefined)
        latest.solve(request('b'))
        workers[0].answer(20)
        expect(workers).toHaveLength(1)
        expect(workers[0].terminated).toBe(false)
        expect(solved).toEqual([
            ['a', 10],
            ['b', 20]
        ])
    })

    it('sends nothing more once requests stop', () => {
        const { latest, workers } = solver()
        latest.solve(request('a'))
        latest.solve(undefined)
        workers[0].answer(10)
        expect(workers[0].posted).toHaveLength(1)
    })

    it('reports a request the router could not solve', () => {
        const { latest, workers, failed } = solver()
        latest.solve(request('a'))
        workers[0].reject()
        expect(failed).toEqual(['a'])
        expect(workers[0].terminated).toBe(false)
    })

    it('replaces a failed worker and sends the request waiting on it', () => {
        const { latest, workers, solved, failed } = solver()
        latest.solve(request('a'))
        latest.solve(request('b'))
        workers[0].fail()
        expect(workers[0].terminated).toBe(true)
        expect(failed).toEqual(['a'])
        workers[1].answer(20)
        expect(solved).toEqual([['b', 20]])
    })

    it('reports a request that cannot be sent', () => {
        const { latest, workers, failed } = solver()
        latest.solve(request('a'))
        workers[0].answer(10)
        workers[0].unclonable = true
        latest.solve(request('b'))
        expect(failed).toEqual(['b'])
        latest.solve(request('c'))
        workers[1].answer(30)
        expect(workers).toHaveLength(2)
    })

    it('stops its worker when destroyed', () => {
        const { latest, workers, solved } = solver()
        latest.solve(request('a'))
        latest.destroy()
        workers[0].answer(10)
        expect(workers[0].terminated).toBe(true)
        expect(solved).toEqual([])
    })
})
