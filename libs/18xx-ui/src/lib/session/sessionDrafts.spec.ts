import { describe, expect, it } from 'vitest'
import { SessionDrafts, clearableDraft, type SessionDraft } from './sessionDrafts.js'

function draft(name: string, log: string[], steps = 0, pending = steps > 0) {
    const state = { steps, pending }
    const entry: SessionDraft = {
        pending: () => state.pending,
        unwind() {
            if (state.steps === 0) return false
            state.steps--
            state.pending = state.steps > 0
            log.push(`unwind:${name}`)
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

describe('SessionDrafts', () => {
    it('unwinds only the first draft that consumes the Undo, in registration order', () => {
        const log: string[] = []
        const drafts = new SessionDrafts()
        drafts.register(draft('empty', log))
        drafts.register(draft('track', log, 1))
        drafts.register(draft('stock', log, 1))
        expect(drafts.unwind()).toBe(true)
        expect(log).toEqual(['unwind:track'])
        expect(drafts.unwind()).toBe(true)
        expect(log).toEqual(['unwind:track', 'unwind:stock'])
    })

    it('reports that nothing consumed the Undo so committed history can be undone', () => {
        const drafts = new SessionDrafts()
        drafts.register(draft('empty', []))
        expect(drafts.unwind()).toBe(false)
    })

    it('unwinds a multi-step draft one step at a time before later drafts', () => {
        const log: string[] = []
        const drafts = new SessionDrafts()
        drafts.register(draft('split', log, 2))
        drafts.register(draft('stock', log, 1))
        drafts.unwind()
        drafts.unwind()
        drafts.unwind()
        expect(log).toEqual(['unwind:split', 'unwind:split', 'unwind:stock'])
    })

    it('lets a title take precedence over the shared drafts', () => {
        const log: string[] = []
        const drafts = new SessionDrafts()
        drafts.register(draft('stock', log, 1))
        drafts.register(draft('split', log, 1), 'first')
        drafts.unwind()
        expect(log).toEqual(['unwind:split'])
    })

    it('keeps pending independent of whether Undo would consume the draft', () => {
        const drafts = new SessionDrafts()
        drafts.register(draft('auto-selected station', [], 0, true))
        expect(drafts.pending()).toBe(true)
        expect(drafts.unwind()).toBe(false)
    })

    it('is pending when any draft is, and clears every draft', () => {
        const log: string[] = []
        const drafts = new SessionDrafts()
        drafts.register(draft('track', log))
        drafts.register(draft('stock', log, 1))
        expect(drafts.pending()).toBe(true)
        drafts.clear()
        expect(drafts.pending()).toBe(false)
        expect(log).toEqual(['clear:track', 'clear:stock'])
    })

    it('treats a clearable draft as pending and consumable only while it is set', () => {
        let value: string | undefined = 'train'
        const drafts = new SessionDrafts()
        drafts.register(clearableDraft(() => value !== undefined, () => { value = undefined }))
        expect(drafts.pending()).toBe(true)
        expect(drafts.unwind()).toBe(true)
        expect(value).toBeUndefined()
        expect(drafts.unwind()).toBe(false)
    })
})
