import { describe, expect, it } from 'vitest'
import { ActionType } from '@tabletop/oath'
import { ALL_ACTIONS, MAJOR_ACTIONS, MINOR_ACTIONS } from './actionCatalogue.js'

/** R-5, R-6 — the counts are the Law's, not the arrays'. */
describe('action catalogue (R-5, R-6)', () => {
    it('R-5 — the six major actions', () => {
        expect(MAJOR_ACTIONS).toHaveLength(6)
        expect(MAJOR_ACTIONS.map((a) => a.type).sort()).toEqual(
            [
                ActionType.Search,
                ActionType.Muster,
                ActionType.Trade,
                ActionType.Recover,
                ActionType.Campaign,
                ActionType.Travel
            ].sort()
        )
    })

    it('R-6 — eight minor action types: a Peek covers R-6.3 (the Reliquary needs none, R-6.4-H1), and letting another peek is its own', () => {
        expect(MINOR_ACTIONS).toHaveLength(8)
        expect(MINOR_ACTIONS.map((a) => a.type)).toContain(ActionType.LetPeek)
        expect(MINOR_ACTIONS.map((a) => a.type)).toContain(ActionType.Peek)
        expect(MINOR_ACTIONS.find((a) => a.type === ActionType.Peek)?.rule).toBe('R-6.3')
    })

    it('R-6.6.2’s answer is not an Act Phase action', () => {
        expect(ALL_ACTIONS.map((a) => a.type)).not.toContain(
            ActionType.ResolveCitizenshipOffer
        )
        // R-6.6.1 — the offer still is one, because asking happens on a normal turn.
        expect(MINOR_ACTIONS.map((a) => a.type)).toContain(ActionType.OfferCitizenship)
    })

    it('no action is listed twice, and none is both major and minor', () => {
        const types = ALL_ACTIONS.map((a) => a.type)
        expect(new Set(types).size).toBe(types.length)
    })

    it('every entry names a real ActionType and cites a rule', () => {
        const known = new Set<string>(Object.values(ActionType))
        for (const entry of ALL_ACTIONS) {
            expect(known.has(entry.type)).toBe(true)
            expect(entry.rule.startsWith('R-')).toBe(true)
            expect(entry.label.length).toBeGreaterThan(0)
            expect(entry.summary.length).toBeGreaterThan(10)
        }
    })

    it('R-6.2 is listed with its Action summary', () => {
        const entry = MINOR_ACTIONS.find((a) => a.type === ActionType.UseActionPower)
        expect(entry).toBeDefined()
        expect(entry?.summary).not.toMatch(/not implemented/)
        expect(entry?.summary).toMatch(/Action:/)
    })
})
