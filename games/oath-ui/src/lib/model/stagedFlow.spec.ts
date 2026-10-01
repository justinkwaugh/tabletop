import { describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { StagedFlow } from './stagedFlow.svelte.js'

type Stages = { first: string; second: string; third: number }
const ORDER = ['first', 'second', 'third'] as const

/** `docs/user-interactions.md` case 4 for every panel draft: each is a `StagedFlow` over its own order. */
describe('StagedFlow', () => {
    it('a stage missing from the flow’s order throws rather than being dropped', () => {
        const flow = new StagedFlow<Stages>(['first', 'second'])
        expect(() => flow.set('third', 1)).toThrow(/does not exist in stage order/)
    })

    it('an auto pick of the value already chosen by hand stays manual', () => {
        const flow = new StagedFlow<Stages>(ORDER)
        flow.set('first', 'a')
        flow.autoSelect('first', 'a')
        flushSync()
        expect(flow.sourceOf('first')).toBe('manual')
        expect(flow.hasManualSelection()).toBe(true)
    })

    it('the highest manual stage skips auto picks above it', () => {
        const flow = new StagedFlow<Stages>(ORDER)
        flow.set('first', 'a')
        flow.set('second', 'b')
        flow.autoSelect('third', 3)
        expect(flow.highestManualStage()).toBe('second')
        expect(flow.back()).toBe('second')
        expect(flow.value('third')).toBeUndefined()
        expect(flow.value('first')).toBe('a')
    })
})
