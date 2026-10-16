import { describe, expect, it } from 'vitest'
import { ReplacementRequest } from './replacementRequest.js'

describe('a replacement this child asked for', () => {
    it('has no outcome to wait for until it is requested', async () => {
        const sent: string[] = []
        const replacement = new ReplacementRequest((message) => sent.push(message))
        await expect(replacement.outcome()).resolves.toBe('none')
        expect(sent).toEqual([])
    })

    it('asks the supervisor and ends when this child is superseded', async () => {
        const sent: string[] = []
        const replacement = new ReplacementRequest((message) => sent.push(message))
        replacement.request()
        replacement.request()
        const outcome = replacement.outcome()
        replacement.settle('superseded')
        await expect(outcome).resolves.toBe('superseded')
        expect(sent).toEqual(['reload', 'reload'])
    })

    it('answers at once and asks for nothing more once superseded', async () => {
        const sent: string[] = []
        const replacement = new ReplacementRequest((message) => sent.push(message))
        replacement.request()
        replacement.settle('superseded')
        replacement.request()
        await expect(replacement.outcome()).resolves.toBe('superseded')
        expect(sent).toEqual(['reload'])
    })

    it('ends when the replacement fails and can be asked for again', async () => {
        const replacement = new ReplacementRequest(() => {})
        replacement.request()
        const failed = replacement.outcome()
        replacement.settle('replacement-failed')
        await expect(failed).resolves.toBe('replacement-failed')
        await expect(replacement.outcome()).resolves.toBe('none')
        replacement.request()
        const retried = replacement.outcome()
        replacement.settle('superseded')
        await expect(retried).resolves.toBe('superseded')
    })

    it('ignores other supervisor messages', async () => {
        const replacement = new ReplacementRequest(() => {})
        replacement.request()
        const outcome = replacement.outcome()
        replacement.settle({ port: 1 })
        replacement.settle('superseded')
        await expect(outcome).resolves.toBe('superseded')
    })
})
