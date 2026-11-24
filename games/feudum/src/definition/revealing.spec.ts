import { describe, expect, it } from 'vitest'
import { ActionType } from './actions.js'
import { FeudumApiActions } from './apiActions.js'
import { markRevealsInfo, RevealingActionTypes } from './revealing.js'

/** The Actions whose schema makes every send reveal. */
function alwaysRevealing(): ActionType[] {
    return Object.entries(FeudumApiActions)
        .filter(([, schema]) => {
            const revealsInfo = (schema as { properties?: Record<string, { const?: unknown }> })
                .properties?.revealsInfo
            return revealsInfo?.const === true
        })
        .map(([type]) => type as ActionType)
}

describe("R-X.2 the Actions that can't be undone are declared", () => {
    it('lists every Action whose every send reveals', () => {
        const listed = new Set<ActionType>(RevealingActionTypes)
        expect(alwaysRevealing().filter((type) => !listed.has(type))).toEqual([])
    })

    it('lists each Action once, and only Actions the game has', () => {
        expect(new Set(RevealingActionTypes).size).toBe(RevealingActionTypes.length)
        for (const type of RevealingActionTypes) {
            expect(Object.keys(FeudumApiActions)).toContain(type)
        }
    })

    it('an Action outside the list may not reveal', () => {
        const action: { type: ActionType; revealsInfo?: boolean } = { type: ActionType.Move }
        expect(() => markRevealsInfo(action, true)).toThrow(/declared/)
        markRevealsInfo(action, false)
        expect(action.revealsInfo).toBe(false)
    })

    it('a listed Action sets the flag as asked', () => {
        const action: { type: ActionType; revealsInfo?: boolean } = { type: ActionType.Improve }
        markRevealsInfo(action, true)
        expect(action.revealsInfo).toBe(true)
    })
})
