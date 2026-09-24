import { describe, expect, it } from 'vitest'
import { LocalSelections, type LocalSelection } from './localSelections.js'

function selection(name: string, log: string[], steps = 0, pending = steps > 0) {
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
    it('unwinds only the first selection that consumes the Undo, in registration order', () => {
        const log: string[] = []
        const selections = new LocalSelections()
        selections.register(selection('empty', log))
        selections.register(selection('track', log, 1))
        selections.register(selection('stock', log, 1))
        expect(selections.undo()).toBe(true)
        expect(log).toEqual(['undo:track'])
        expect(selections.undo()).toBe(true)
        expect(log).toEqual(['undo:track', 'undo:stock'])
    })

    it('reports that nothing consumed the Undo so committed history can be undone', () => {
        const selections = new LocalSelections()
        selections.register(selection('empty', []))
        expect(selections.undo()).toBe(false)
    })

    it('unwinds a multi-step selection one step at a time before later selections', () => {
        const log: string[] = []
        const selections = new LocalSelections()
        selections.register(selection('split', log, 2))
        selections.register(selection('stock', log, 1))
        selections.undo()
        selections.undo()
        selections.undo()
        expect(log).toEqual(['undo:split', 'undo:split', 'undo:stock'])
    })

    it('lets a title take precedence over the shared selections', () => {
        const log: string[] = []
        const selections = new LocalSelections()
        selections.register(selection('stock', log, 1))
        selections.register(selection('split', log, 1), 'first')
        selections.undo()
        expect(log).toEqual(['undo:split'])
    })

    it('keeps pending independent of whether Undo would consume the selection', () => {
        const selections = new LocalSelections()
        selections.register(selection('auto-selected station', [], 0, true))
        expect(selections.hasManual()).toBe(true)
        expect(selections.undo()).toBe(false)
    })

    it('is pending when any selection is, and clears every selection', () => {
        const log: string[] = []
        const selections = new LocalSelections()
        selections.register(selection('track', log))
        selections.register(selection('stock', log, 1))
        expect(selections.hasManual()).toBe(true)
        selections.clear()
        expect(selections.hasManual()).toBe(false)
        expect(log).toEqual(['clear:track', 'clear:stock'])
    })
})
