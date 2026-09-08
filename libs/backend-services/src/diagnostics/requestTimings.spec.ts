import { describe, expect, it } from 'vitest'
import { setTimeout as delay } from 'node:timers/promises'
import { RequestTimings, Timed, measure, measureSync, countTiming } from './requestTimings.js'

describe('request timing isolation', () => {
    it('keeps concurrent requests and nested operations separate', async () => {
        const requests = [new RequestTimings(), new RequestTimings()]
        await Promise.all(
            requests.map((request, index) =>
                request.run(() =>
                    measure(`request-${index}`, async () => {
                        await delay(index + 1)
                        countTiming('attempts')
                        return measureSync('engine', () => index)
                    })
                )
            )
        )
        for (const [index, request] of requests.entries()) {
            const result = request.finish()
            expect(result.counters).toEqual({ attempts: 1 })
            expect(result.spans).toEqual([
                expect.objectContaining({ id: 0, name: `request-${index}`, status: 'ok' }),
                expect.objectContaining({ id: 1, parentId: 0, name: 'engine', status: 'ok' })
            ])
            expect(result.spans[0].durationMs).toBeGreaterThanOrEqual(result.spans[1].durationMs)
        }
    })

    it('preserves values, receiver, generic methods, and exact errors', async () => {
        const failure = new Error('private failure message')
        class Service {
            value = 7
            @Timed('service')
            async call<T>(input: T): Promise<T> {
                expect(this.value).toBe(7)
                if (input === failure) throw failure
                return input
            }
        }
        const service = new Service()
        expect(await service.call(3)).toBe(3)
        const timings = new RequestTimings()
        await timings.run(async () => {
            await expect(service.call(failure)).rejects.toBe(failure)
            expect(() =>
                measureSync('sync', () => {
                    throw failure
                })
            ).toThrow(failure)
        })
        const result = timings.finish()
        expect(result.spans.map((span) => span.status)).toEqual(['error', 'error'])
        expect(JSON.stringify(result)).not.toContain(failure.message)
    })

    it('bounds spans and freezes the report when detached work finishes later', async () => {
        const timings = new RequestTimings()
        const gate = Promise.withResolvers<void>()
        const background = timings.run(() =>
            measure('background', async () => {
                await gate.promise
                countTiming('late')
                await measure('late', async () => {})
            })
        )
        timings.run(() => {
            for (let i = 0; i < 300; i++) measureSync('operation', () => i)
        })
        const report = timings.finish()
        const serialized = JSON.stringify(report)
        expect(report.spans).toHaveLength(256)
        expect(report.droppedSpans).toBe(45)
        expect(report.spans[0].status).toBe('pending')
        gate.resolve()
        await background
        expect(JSON.stringify(report)).toBe(serialized)
        expect(report.counters).toEqual({})
    })
})
