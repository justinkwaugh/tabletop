import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { LocationKind } from '../data/discs.js'
import type { Epoch } from '../data/tracks.js'
import { initialState } from '../testing/state.js'
import { activeRegionIds, activeRegionVp, disloyaltyVp } from './activeRegions.js'

const OnePerRegion: readonly SpaceId[] = [
    'space.sea.1',
    'space.island.1',
    'space.forest.1',
    'space.desert.1',
    'space.badlands.1',
    'space.mountain.1'
]

describe('R-4.12.1 active regions', () => {
    it.each([
        { regions: 0, vp: 0 },
        { regions: 1, vp: 1 },
        { regions: 2, vp: 3 },
        { regions: 3, vp: 5 },
        { regions: 4, vp: 7 },
        { regions: 5, vp: 9 },
        { regions: 6, vp: 11 }
    ])('$regions regions score $vp', ({ regions, vp }) => {
        const state = initialState()
        for (const spaceId of OnePerRegion.slice(0, regions)) {
            state.spaces[spaceId].ruler = { playerId: 'p1', subject: false }
        }
        expect(activeRegionIds(state, 'p1')).toHaveLength(regions)
        expect(activeRegionVp(state, 'p1')).toBe(vp)
    })

    it('counts a region once however many spaces are ruled there', () => {
        const state = initialState()
        state.spaces['space.sea.1'].ruler = { playerId: 'p1', subject: false }
        state.spaces['space.sea.2'].ruler = { playerId: 'p1', subject: false }
        expect(activeRegionIds(state, 'p1')).toEqual(['sea'])
    })

    it('R-4.1.4 a tending serf counts, a serf without a landscape does not', () => {
        const state = initialState()
        state.spaces['space.sea.1'].serf = { playerId: 'p1' }
        expect(activeRegionIds(state, 'p1')).toEqual([])

        state.spaces['space.sea.1'].landscape = { tileId: 'tile.sea.i', amount: 0 }
        expect(activeRegionIds(state, 'p1')).toEqual(['sea'])
        expect(activeRegionIds(state, 'p2')).toEqual([])
    })

    it('another player ruling the space gives nothing', () => {
        const state = initialState()
        state.spaces['space.sea.1'].ruler = { playerId: 'p2', subject: true }
        expect(activeRegionIds(state, 'p1')).toEqual([])
    })
})

describe('R-4.9.2 vassals', () => {
    it.each([
        { kind: 'outpost', ruler: 'p1', vassal: false },
        { kind: 'farm', ruler: 'p1', vassal: false },
        { kind: 'town', ruler: 'p1', vassal: false },
        { kind: 'feudum', ruler: 'p1', vassal: true },
        { kind: 'feudum', ruler: 'p2', vassal: false }
    ] satisfies { kind: LocationKind; ruler: string; vassal: boolean }[])(
        '$kind ruled by $ruler: $vassal',
        ({ kind, ruler, vassal }) => {
            const state = initialState()
            state.spaces['space.sea.1'].location.kind = kind
            state.spaces['space.sea.1'].ruler = { playerId: ruler, subject: false }
            expect(state.isVassal('p1')).toBe(vassal)
        }
    )

    function vassal(covered: number) {
        const state = initialState()
        state.spaces['space.sea.1'].location.kind = 'feudum'
        state.spaces['space.sea.1'].ruler = { playerId: 'p1', subject: false }
        state.militaryService.p1 = covered
        return state
    }

    it.each([
        { covered: 0, II: -3, III: 0, IV: -7, V: -12 },
        { covered: 1, II: 0, III: 0, IV: -4, V: -9 },
        { covered: 2, II: 0, III: 0, IV: 0, V: -5 },
        { covered: 3, II: 0, III: 0, IV: 0, V: 0 }
    ])(
        'with $covered spaces covered: II $II, III $III, IV $IV, V $V',
        ({ covered, II, III, IV, V }) => {
            const state = vassal(covered)
            const at = (dawn: Epoch) => disloyaltyVp(state, 'p1', dawn)
            expect([at(2), at(3), at(4), at(5)]).toEqual([II, III, IV, V])
        }
    )

    it('a vassal from epoch I who never serves loses 22 in all', () => {
        const state = vassal(0)
        const dawns: Epoch[] = [2, 3, 4, 5]
        expect(dawns.reduce((sum, dawn) => sum + disloyaltyVp(state, 'p1', dawn), 0)).toBe(-22)
    })

    it('a player who is no vassal loses nothing, served or not', () => {
        const state = initialState()
        const dawns: Epoch[] = [2, 3, 4, 5]
        for (const dawn of dawns) {
            expect(disloyaltyVp(state, 'p1', dawn)).toBe(0)
        }
    })

    it("R-4.9-H2 only the vassal's own discs cover their spaces", () => {
        const state = vassal(0)
        state.militaryService.p2 = 3
        expect(disloyaltyVp(state, 'p1', 2)).toBe(-3)
    })
})
