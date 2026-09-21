import { describe, expect, it } from 'vitest'
import { LocalSelections, type LocalSelection } from './localSelections.js'

function draft(name: string, log: string[], steps = 0, pending = steps > 0) {
    const state = { steps, pending }
    const entry: LocalSelection = {
        hasManual: () => state.pending,
        undo() {
            if (state.steps === 0) return false
            state.steps--
            state.pending = state.steps > 0
            log.push(`undo:${name}`)
            return true
        },
        clear() {
            state.steps = 0
            state.pending = false
            log.push(`clear:${name}`)
        }
    }
    return entry
}

describe('LocalSelections', () => {
    it('unwinds only the first draft that consumes the Undo, in registration order', () => {
        const log: string[] = []
        const drafts = new LocalSelections()
        drafts.register(draft('empty', log))
        drafts.register(draft('track', log, 1))
        drafts.register(draft('stock', log, 1))
        expect(drafts.undo()).toBe(true)
        expect(log).toEqual(['undo:track'])
        expect(drafts.undo()).toBe(true)
        expect(log).toEqual(['undo:track', 'undo:stock'])
    })

    it('reports that nothing consumed the Undo so committed history can be undone', () => {
        const drafts = new LocalSelections()
        drafts.register(draft('empty', []))
        expect(drafts.undo()).toBe(false)
    })

    it('unwinds a multi-step draft one step at a time before later drafts', () => {
        const log: string[] = []
        const drafts = new LocalSelections()
        drafts.register(draft('split', log, 2))
        drafts.register(draft('stock', log, 1))
        drafts.undo()
        drafts.undo()
        drafts.undo()
        expect(log).toEqual(['undo:split', 'undo:split', 'undo:stock'])
    })

    it('lets a title take precedence over the shared drafts', () => {
        const log: string[] = []
        const drafts = new LocalSelections()
        drafts.register(draft('stock', log, 1))
        drafts.register(draft('split', log, 1), 'first')
        drafts.undo()
        expect(log).toEqual(['undo:split'])
    })

    it('keeps pending independent of whether Undo would consume the draft', () => {
        const drafts = new LocalSelections()
        drafts.register(draft('auto-selected station', [], 0, true))
        expect(drafts.hasManual()).toBe(true)
        expect(drafts.undo()).toBe(false)
    })

    it('is pending when any draft is, and clears every draft', () => {
        const log: string[] = []
        const drafts = new LocalSelections()
        drafts.register(draft('track', log))
        drafts.register(draft('stock', log, 1))
        expect(drafts.hasManual()).toBe(true)
        drafts.clear()
        expect(drafts.hasManual()).toBe(false)
        expect(log).toEqual(['clear:track', 'clear:stock'])
    })
})
