import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    IMPERIAL_WARBANDS,
    PowerChoiceKind,
    Suit,
    type LegalChoice,
    type PowerChoice,
    type WarbandGroup
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import {
    NO_OPTION,
    emptyPicks,
    gridCeilingAt,
    gridCounts,
    hasPicks,
    openCountCeiling,
    optionIndexOf,
    picksComplete,
    powerChoicesFrom,
    warbandGrids,
    withGridCount,
    withOptionPick,
    type PowerChoicePicks,
    type WarbandGrid
} from './powerChoices.js'

const warbands = (group: WarbandGroup): PowerChoice => ({ kind: PowerChoiceKind.Warbands, group })
const atSite = (siteId: string, owner: string, count: number) =>
    warbands({ at: { kind: 'site', siteId }, owner, count })
const onBoard = (playerId: string, owner: string, count: number) =>
    warbands({ at: { kind: 'board', playerId }, owner, count })

/** The one grid a power's choices draw. */
function gridOf(choices: readonly LegalChoice[]): WarbandGrid {
    const [grid, ...rest] = warbandGrids(choices)
    expect(rest).toEqual([])
    if (!grid) throw Error('The choices draw a grid')
    return grid
}

function tapped(choices: readonly LegalChoice[], ...counts: [number, number][]): PowerChoicePicks {
    const grid = gridOf(choices)
    return counts.reduce(
        (picks, [row, count]) => withGridCount(picks, grid, row, count),
        emptyPicks()
    )
}

/** "Kill any two warbands in your region (at sites or on boards, even yours)": two picks, one domain. */
const regionGroups = [
    atSite('slum', 'me', 2),
    atSite('river', 'rhys', 3),
    onBoard('me', 'me', 3),
    onBoard('rhys', 'rhys', 2)
]
const terror = (options: PowerChoice[] = regionGroups): LegalChoice[] => [
    { spec: { kind: PowerChoiceKind.Warbands, min: 1, max: 1, together: 2 }, options },
    { spec: { kind: PowerChoiceKind.Warbands, min: 0, max: 1, together: 2 }, options }
]

describe('a power’s warbands as rows of pieces — Terror Spells’ two kills', () => {
    it('its two picks are one grid over the places, every count starting empty', () => {
        const grid = gridOf(terror())
        expect(grid.specs).toEqual([0, 1])
        expect(grid.groups).toEqual(
            regionGroups.map((option) => option.kind === PowerChoiceKind.Warbands && option.group)
        )
        expect(grid.total).toBe(2)
        expect(grid.exact).toBe(true)
        // One colour per place (R-6.6.2): the pieces say whose they are, so no row names an owner.
        expect(grid.namesOwners).toBe(false)
        const twoOnOneBoard = terror([...regionGroups, onBoard('me', IMPERIAL_WARBANDS, 1)])
        expect(gridOf(twoOnOneBoard).namesOwners).toBe(true)
        expect(gridCounts(grid, emptyPicks())).toEqual([0, 0, 0, 0])
        expect(powerChoicesFrom(terror(), emptyPicks())).toEqual([])
        expect(picksComplete(terror(), emptyPicks())).toBe(false)
        expect(hasPicks(emptyPicks())).toBe(false)
    })

    it('a count tapped back to none is no pick', () => {
        const grid = gridOf(terror())
        expect(hasPicks(withGridCount(tapped(terror(), [1, 2]), grid, 1, 0))).toBe(false)
        expect(hasPicks(withGridCount(tapped(terror(), [1, 2]), grid, 1, 1))).toBe(true)
    })

    it('two at one place: every other piece goes untappable, and one choice is sent', () => {
        const grid = gridOf(terror())
        const picks = tapped(terror(), [1, 2])
        expect(hasPicks(picks)).toBe(true)
        const counts = gridCounts(grid, picks)
        expect(counts).toEqual([0, 2, 0, 0])
        expect([0, 1, 2, 3].map((row) => gridCeilingAt(grid, counts, row))).toEqual([0, 2, 0, 0])
        expect(picksComplete(terror(), picks)).toBe(true)
        expect(powerChoicesFrom(terror(), picks)).toEqual([atSite('river', 'rhys', 2)])
    })

    it('one each from two places, your own board among them: two choices, in the places’ order', () => {
        const picks = tapped(terror(), [3, 1], [0, 1])
        expect(picksComplete(terror(), picks)).toBe(true)
        expect(powerChoicesFrom(terror(), picks)).toEqual([
            atSite('slum', 'me', 1),
            onBoard('rhys', 'rhys', 1)
        ])
    })

    it('one picked waits for the second; lowering a count opens the others again', () => {
        const grid = gridOf(terror())
        const picks = tapped(terror(), [2, 1])
        expect(picksComplete(terror(), picks)).toBe(false)
        expect(
            [0, 1, 2, 3].map((row) => gridCeilingAt(grid, gridCounts(grid, picks), row))
        ).toEqual([1, 1, 2, 1])
        const lowered = withGridCount(tapped(terror(), [2, 2]), grid, 2, 0)
        expect(
            [0, 1, 2, 3].map((row) => gridCeilingAt(grid, gridCounts(grid, lowered), row))
        ).toEqual([2, 2, 2, 2])
    })

    it('a count is never more than the rows allow, whatever is asked', () => {
        const grid = gridOf(terror())
        expect(gridCounts(grid, withGridCount(emptyPicks(), grid, 2, 3))).toEqual([0, 0, 2, 0])
        const full = tapped(terror(), [0, 1], [1, 1])
        expect(gridCounts(grid, withGridCount(full, grid, 3, 1))).toEqual([1, 1, 0, 0])
    })

    it('R-7.1.3 — with only one warband in the region, the total is that one', () => {
        const lone = terror([atSite('river', 'rhys', 1)])
        const grid = gridOf(lone)
        expect(grid.total).toBe(1)
        const picks = tapped(lone, [0, 1])
        expect(picksComplete(lone, picks)).toBe(true)
        expect(powerChoicesFrom(lone, picks)).toEqual([atSite('river', 'rhys', 1)])
    })
})

describe('a power’s warbands as rows of pieces — Blood Pact’s pairs', () => {
    const pact: LegalChoice[] = [
        {
            spec: { kind: PowerChoiceKind.Warbands, min: 1, max: 1, step: 2 },
            options: [onBoard('me', 'me', 5)]
        }
    ]

    it('the board is its one row, nothing picked; the ceiling stops at the last whole pair', () => {
        const grid = gridOf(pact)
        expect(grid.step).toBe(2)
        expect(gridCounts(grid, emptyPicks())).toEqual([0])
        expect(gridCeilingAt(grid, [0], 0)).toBe(4)
        expect(picksComplete(pact, emptyPicks())).toBe(false)
    })

    it('a pair picked is a whole use; two pairs sacrifice four', () => {
        expect(picksComplete(pact, tapped(pact, [0, 2]))).toBe(true)
        expect(powerChoicesFrom(pact, tapped(pact, [0, 4]))).toEqual([onBoard('me', 'me', 4)])
    })

    it('an odd count is never kept: it stops at the pair under it', () => {
        const grid = gridOf(pact)
        expect(gridCounts(grid, tapped(pact, [0, 3]))).toEqual([2])
        expect(gridCounts(grid, tapped(pact, [0, 5]))).toEqual([4])
    })
})

describe('a power’s warbands as rows of pieces — the Obsidian Cage', () => {
    // R-7.1.3-H1 — the Cage's purple may go to any Imperial board; each board is a row.
    const cage: LegalChoice[] = [
        {
            spec: { kind: PowerChoiceKind.Warbands, min: 1, max: 16 },
            options: [
                onBoard('red', 'red', 3),
                onBoard('chan', IMPERIAL_WARBANDS, 2),
                onBoard('cit', IMPERIAL_WARBANDS, 2)
            ]
        }
    ]

    it('a row per board, nothing picked, nothing sent', () => {
        const grid = gridOf(cage)
        expect(grid.specs).toEqual([0])
        expect(gridCounts(grid, emptyPicks())).toEqual([0, 0, 0])
        expect(powerChoicesFrom(cage, emptyPicks())).toEqual([])
        expect(picksComplete(cage, emptyPicks())).toBe(false)
    })

    it('a colour’s rows share what the Cage holds of it; another colour’s row is its own', () => {
        const grid = gridOf(cage)
        const counts = gridCounts(grid, tapped(cage, [1, 1]))
        expect([0, 1, 2].map((row) => gridCeilingAt(grid, counts, row))).toEqual([3, 2, 1])
        const both = gridCounts(grid, tapped(cage, [1, 1], [2, 1]))
        expect([0, 1, 2].map((row) => gridCeilingAt(grid, both, row))).toEqual([3, 1, 1])
    })

    it('sends every row with a count, in the rows’ order, once one is picked', () => {
        const picks = tapped(cage, [2, 1], [0, 2])
        expect(picksComplete(cage, picks)).toBe(true)
        expect(powerChoicesFrom(cage, picks)).toEqual([
            onBoard('red', 'red', 2),
            onBoard('cit', IMPERIAL_WARBANDS, 1)
        ])
    })
})

describe('picksComplete — a confirm shows once every spec has its least picks', () => {
    const bank: LegalChoice = {
        spec: { kind: PowerChoiceKind.FavorBank, min: 1, max: 1 },
        options: [
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Arcane },
            { kind: PowerChoiceKind.FavorBank, suit: Suit.Hearth }
        ]
    }
    const maybe: LegalChoice = { ...bank, spec: { ...bank.spec, min: 0 } }

    it('a required single pick waits for a pick unless it has one option; an optional one is complete with none', () => {
        expect(picksComplete([bank], emptyPicks())).toBe(false)
        expect(picksComplete([bank], { ...emptyPicks(), option: { 0: 1 } })).toBe(true)
        expect(picksComplete([bank], { ...emptyPicks(), option: { 0: NO_OPTION } })).toBe(false)
        expect(picksComplete([{ ...bank, options: [bank.options[1]] }], emptyPicks())).toBe(true)
        expect(picksComplete([maybe], emptyPicks())).toBe(true)
        expect(picksComplete([{ ...bank, options: [] }], emptyPicks())).toBe(false)
    })
})

describe('optionIndexOf — no default where the player has a choice', () => {
    const player = (playerId: string): PowerChoice => ({ kind: PowerChoiceKind.Player, playerId })
    const call: LegalChoice = {
        spec: { kind: PowerChoiceKind.Player, min: 1, max: 1 },
        options: [player('rhys'), player('ann')]
    }

    it('a required single pick starts with nothing picked', () => {
        expect(optionIndexOf(call, 0, emptyPicks())).toBe(NO_OPTION)
        expect(powerChoicesFrom([call], emptyPicks())).toEqual([])
    })

    it('a required single pick with one legal option starts on it', () => {
        const only: LegalChoice = { ...call, options: [player('ann')] }
        expect(optionIndexOf(only, 0, emptyPicks())).toBe(0)
        expect(powerChoicesFrom([only], emptyPicks())).toEqual([player('ann')])
        expect(picksComplete([only], emptyPicks())).toBe(true)
    })

    it('an optional single pick starts with nothing picked, even with one option', () => {
        const maybe: LegalChoice = { spec: { ...call.spec, min: 0 }, options: [player('rhys')] }
        expect(optionIndexOf(maybe, 0, emptyPicks())).toBe(NO_OPTION)
    })

    it('a pick made is kept', () => {
        expect(optionIndexOf(call, 0, { ...emptyPicks(), option: { 0: 1 } })).toBe(1)
        expect(powerChoicesFrom([call], { ...emptyPicks(), option: { 0: 1 } })).toEqual([
            player('ann')
        ])
    })
})

describe("openCountCeiling — how far an open count runs (Witch's Bargain)", () => {
    const holding = (advisers: string[]) => {
        const state = testState([
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                favor: 0,
                secrets: 3,
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true }))
            })
        ])
        state.favorBank[Suit.Nomad] = 8
        return state
    }

    it('stops at the secrets or the favor on the board, whichever is more', () => {
        expect(openCountCeiling(holding([]), 'me')).toBe(3)
    })

    it('R-7.1.2 — counts the favor Vow of Kinship keeps in the nomad bank', () => {
        expect(openCountCeiling(holding(['denizen.nomad.vow-of-kinship']), 'me')).toBe(8)
    })

    it('offers nothing to a viewer with no seat', () => {
        expect(openCountCeiling(holding([]), undefined)).toBe(0)
    })
})

describe('an exchange choice — the player, then terms that name something, every site counted', () => {
    const deal: LegalChoice = {
        spec: { kind: PowerChoiceKind.Exchange, min: 1, max: 1, allows: { sites: true } },
        options: [
            { kind: PowerChoiceKind.Exchange, withPlayerId: 'rhys', terms: {} },
            { kind: PowerChoiceKind.Exchange, withPlayerId: 'ann', terms: {} }
        ]
    }
    const withRhys = { ...emptyPicks(), option: { 0: 0 } }

    it('"Use" waits for terms that name something', () => {
        expect(picksComplete([deal], emptyPicks())).toBe(false)
        expect(picksComplete([deal], withRhys)).toBe(false)
        const named = {
            ...withRhys,
            terms: { 0: { terms: { fromProposer: { favor: 1 } }, uncountedSiteIds: [] } }
        }
        expect(picksComplete([deal], named)).toBe(true)
        expect(powerChoicesFrom([deal], named)).toEqual([
            {
                kind: PowerChoiceKind.Exchange,
                withPlayerId: 'rhys',
                terms: { fromProposer: { favor: 1 } }
            }
        ])
    })

    it('"Use" waits for every picked site to have its count', () => {
        const uncounted = {
            ...withRhys,
            terms: { 0: { terms: { fromProposer: { favor: 1 } }, uncountedSiteIds: ['c1'] } }
        }
        expect(picksComplete([deal], uncounted)).toBe(false)
    })

    it('another player picked drops the terms written for the last one', () => {
        const named = {
            ...withRhys,
            terms: { 0: { terms: { fromProposer: { favor: 1 } }, uncountedSiteIds: [] } }
        }
        expect(withOptionPick(named, deal, 0, 1).terms).toEqual({})
        expect(withOptionPick(named, deal, 0, 0).terms).toEqual(named.terms)
    })
})
