import { describe, expect, it } from 'vitest'
import { StagedSelectionStore, singleChoiceStore } from './stagedSelectionStore.svelte.js'

type Stages = { token: string; position: number }
const Order = ['token', 'position'] as const satisfies readonly (keyof Stages)[]

describe('StagedSelectionStore', () => {
    it('clears later stages when an earlier stage is chosen again', () => {
        const store = new StagedSelectionStore<Stages>(Order)
        store.choose('token', 'a')
        store.choose('position', 1)
        store.choose('token', 'b')
        expect(store.value('token')).toBe('b')
        expect(store.value('position')).toBeUndefined()
    })

    it('backs out one manual stage at a time', () => {
        const store = new StagedSelectionStore<Stages>(Order)
        store.choose('token', 'a')
        store.choose('position', 1)
        expect(store.back()).toBe(true)
        expect(store.state).toEqual({ token: { value: 'a', source: 'manual' } })
        expect(store.back()).toBe(true)
        expect(store.back()).toBe(false)
    })

    it('clears the whole manual selection on Undo by default', () => {
        const store = new StagedSelectionStore<Stages>(Order)
        store.choose('token', 'a')
        store.choose('position', 1)
        expect(store.undo()).toBe(true)
        expect(store.state).toEqual({})
        expect(store.undo()).toBe(false)
    })

    it('pops one manual stage on Undo when the flow asks for it', () => {
        const store = new StagedSelectionStore<Stages>(Order, 'pop-stage')
        store.choose('token', 'a')
        store.choose('position', 1)
        expect(store.undo()).toBe(true)
        expect(store.value('token')).toBe('a')
        expect(store.value('position')).toBeUndefined()
    })

    it('never lets Undo consume a selection that holds only automatic stages', () => {
        const store = new StagedSelectionStore<Stages>(Order)
        store.choose('token', 'a', 'auto')
        expect(store.hasManual()).toBe(false)
        expect(store.undo()).toBe(false)
        expect(store.value('token')).toBe('a')
    })

    it('holds a single choice as a one-stage staged selection', () => {
        const store = singleChoiceStore<string>()
        store.choose('choice', 'withhold')
        expect(store.state).toEqual({ choice: { value: 'withhold', source: 'manual' } })
        expect(store.undo()).toBe(true)
        expect(store.value('choice')).toBeUndefined()
    })
})
