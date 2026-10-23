import { describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { StagedFlow, TapHistoryDraft } from './stagedFlow.svelte.js'

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

type Typed = { n: number; a: string; b: string }

/** A draft with a count and two text boxes, `a` and `b`. */
class TypedDraft extends TapHistoryDraft<Typed> {
    constructor() {
        super({ n: 0, a: '', b: '' })
    }
    get value(): Typed {
        return this.current
    }
    set(change: Partial<Typed>): void {
        this.tap({ ...this.current, ...change })
    }
    protected isBare(value: Typed): boolean {
        return value.n === 0 && value.a === '' && value.b === ''
    }
    protected textEdited(from: Typed, to: Typed): string | undefined {
        if (from.n !== to.n) return undefined
        if (from.a !== to.a) return from.b === to.b ? 'a' : undefined
        return from.b !== to.b ? 'b' : undefined
    }
}

describe('TapHistoryDraft — a box typed in is one pick for Undo', () => {
    it('the letters typed in one box after a tap go back in one Undo, and the tap in the next', () => {
        const draft = new TypedDraft()
        draft.set({ n: 1 })
        for (const text of ['I', 'I s', 'I stay']) draft.set({ a: text })
        expect(draft.back()).toBe(true)
        expect(draft.value).toEqual({ n: 1, a: '', b: '' })
        expect(draft.back()).toBe(true)
        expect(draft.value).toEqual({ n: 0, a: '', b: '' })
    })

    it('another box, or a tap between, starts a new pick', () => {
        const draft = new TypedDraft()
        draft.set({ n: 1 })
        draft.set({ a: 'x' })
        draft.set({ a: 'xy' })
        draft.set({ b: 'z' })
        draft.set({ n: 2 })
        draft.set({ a: 'xyw' })
        draft.back()
        expect(draft.value).toEqual({ n: 2, a: 'xy', b: 'z' })
        draft.back()
        expect(draft.value).toEqual({ n: 1, a: 'xy', b: 'z' })
        draft.back()
        expect(draft.value).toEqual({ n: 1, a: 'xy', b: '' })
        draft.back()
        expect(draft.value).toEqual({ n: 1, a: '', b: '' })
    })

    it('a box typed back to its text before is no pick: Undo takes the tap before it', () => {
        const draft = new TypedDraft()
        draft.set({ n: 1 })
        draft.set({ n: 2 })
        draft.set({ a: 'x' })
        draft.set({ a: '' })
        expect(draft.value).toEqual({ n: 2, a: '', b: '' })
        draft.back()
        expect(draft.value).toEqual({ n: 1, a: '', b: '' })
    })

    it('typing first, from the opened panel, then erasing it leaves the panel as it opened', () => {
        const draft = new TypedDraft()
        draft.set({ a: 'x' })
        draft.set({ a: '' })
        expect(draft.hasManualSelection()).toBe(false)
    })
})
