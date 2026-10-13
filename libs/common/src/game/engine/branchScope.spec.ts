import { describe, expect, it } from 'vitest'
import { findBranchScopeViolation } from './branchScope.js'
import { createPatch } from './statePatch.js'

function violation(playerId: string, before: unknown, after: unknown): string | undefined {
    return findBranchScopeViolation({
        before,
        after,
        playerId,
        undoPatch: createPatch(after, before)
    })
}

describe('Branch Scope ownership', () => {
    it('rejects taking the Player’s identity off an object that stays', () => {
        const before = { flag: { playerId: 'p2', label: 'owned' } }
        const after = { flag: { label: 'owned' } }
        expect(violation('p2', before, after)).toBe('/flag/playerId')
    })

    it('allows removing a whole entry the Player owns', () => {
        const before = { items: { mine: { playerId: 'p2', label: 'owned' } } }
        expect(violation('p2', before, { items: {} })).toBeUndefined()
    })

    it('allows removing something from inside what the Player owns', () => {
        const before = { players: [{ playerId: 'p2', hand: { card: { label: 'held' } } }] }
        const after = { players: [{ playerId: 'p2', hand: {} }] }
        expect(violation('p2', before, after)).toBeUndefined()
    })

    describe('where one Player’s object sits inside another’s', () => {
        const empty = { lockers: { theirs: { playerId: 'p3', items: {} } } }
        const holding = (label: string) => ({
            lockers: { theirs: { playerId: 'p3', items: { mine: { playerId: 'p2', label } } } }
        })

        it('rejects adding an entry of the Player’s own inside what another Player owns', () => {
            expect(violation('p2', empty, holding('new'))).toBe('/lockers/theirs/items/mine')
        })

        it('rejects changing or removing the inner object as the Player whose identity it carries', () => {
            expect(violation('p2', holding('old'), holding('new'))).toBe(
                '/lockers/theirs/items/mine/label'
            )
            expect(violation('p2', holding('old'), empty)).toBe('/lockers/theirs/items/mine')
        })

        it('leaves the inner object to the Player who owns what it sits in', () => {
            expect(violation('p3', holding('old'), holding('new'))).toBeUndefined()
            expect(violation('p3', holding('old'), empty)).toBeUndefined()
        })
    })
})
