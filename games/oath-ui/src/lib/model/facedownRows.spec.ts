import { describe, expect, it } from 'vitest'
import { HydratedOathGameState, type LegalChoice, type LegalPowerUse } from '@tabletop/oath'
import { served, spectator } from '@tabletop/oath/testing'
import {
    DANA_OWN,
    DREAM_THIEF,
    INQUISITOR,
    IVORY_EYE,
    MARA_ONE,
    RHYS_PEEKED,
    RHYS_VISION,
    facedownPickerState,
    type FacedownPower
} from '$lib/testing/facedownPickerTables.js'
import { adviserPairs, facedownSeatRows, pairPicked, withPairTap } from './facedownRows.js'
import { listedActionPowers } from './phaseDrafts.js'
import { facedownAdviserLabel } from './names.js'
import { awaitsFirstPick, emptyPicks, NO_OPTION, withOptionPick } from './powerChoices.js'

const [TUTOR, HERALD] = DANA_OWN

function powerOf(state: HydratedOathGameState, cardId: string): LegalPowerUse {
    const power = listedActionPowers(state, 'Dana').find((p) => p.cardId === cardId)
    if (!power) throw Error(`${cardId} is not listed`)
    return power
}

/** The rows of the power's first choice as `viewerId` draws them from `state`. */
function rowsOn(state: HydratedOathGameState, viewerId: string | undefined, legal: LegalChoice) {
    const rows = facedownSeatRows(
        legal.options,
        (playerId) => state.getPlayerState(playerId),
        viewerId,
        (playerId, index) => facedownAdviserLabel(state, playerId, playerId, index)
    )
    return rows?.map((row) => ({
        seat: row.playerId,
        cards: row.cards.map((card) => card.cardId ?? `back: ${card.label}`)
    }))
}

/** Each view a client can be served, and the whole state a hotseat or host client holds. */
function views(power: FacedownPower, viewerId: string | undefined) {
    const whole = facedownPickerState(power)
    const perspective = viewerId ? { kind: 'player' as const, playerId: viewerId } : spectator
    const own = new HydratedOathGameState(served(whole, perspective))
    return { whole, own }
}

describe("R-9.4 — a facedown adviser choice, a row per holder, faced only where the viewer's view names it", () => {
    const legal = powerOf(facedownPickerState('dreamThief'), DREAM_THIEF).choices[0]

    const expected: Record<string, { seat: string; cards: string[] }[]> = {
        Dana: [
            { seat: 'Dana', cards: [TUTOR, HERALD] },
            { seat: 'Rhys', cards: [RHYS_PEEKED, "back: Rhys's facedown adviser 2"] },
            { seat: 'Mara', cards: ["back: Mara's facedown adviser 1"] }
        ],
        Rhys: [
            {
                seat: 'Dana',
                cards: ["back: Dana's facedown adviser 1", "back: Dana's facedown adviser 2"]
            },
            { seat: 'Rhys', cards: [RHYS_PEEKED, RHYS_VISION] },
            { seat: 'Mara', cards: ["back: Mara's facedown adviser 1"] }
        ],
        Mara: [
            {
                seat: 'Dana',
                cards: ["back: Dana's facedown adviser 1", "back: Dana's facedown adviser 2"]
            },
            {
                seat: 'Rhys',
                cards: ["back: Rhys's facedown adviser 1", "back: Rhys's facedown adviser 2"]
            },
            { seat: 'Mara', cards: [MARA_ONE] }
        ],
        spectator: [
            {
                seat: 'Dana',
                cards: ["back: Dana's facedown adviser 1", "back: Dana's facedown adviser 2"]
            },
            {
                seat: 'Rhys',
                cards: ["back: Rhys's facedown adviser 1", "back: Rhys's facedown adviser 2"]
            },
            { seat: 'Mara', cards: ["back: Mara's facedown adviser 1"] }
        ]
    }

    for (const [viewer, rows] of Object.entries(expected)) {
        const viewerId = viewer === 'spectator' ? undefined : viewer
        it(`${viewer}'s view: their own facedown advisers and the ones shown to them face up, every other a back`, () => {
            const { whole, own } = views('dreamThief', viewerId)
            expect(rowsOn(own, viewerId, legal)).toEqual(rows)
            // A client holding every card still draws only what this viewer may know.
            expect(rowsOn(whole, viewerId, legal)).toEqual(rows)
        })
    }

    it('a Vision held facedown is drawn with the Vision back to anyone but its holder', () => {
        const { own } = views('dreamThief', 'Dana')
        const rows = facedownSeatRows(
            legal.options,
            (id) => own.getPlayerState(id),
            'Dana',
            () => ''
        )
        expect(rows?.[1]?.cards[1]).toMatchObject({ back: 'vision' })
        expect(rows?.[2]?.cards[0]).toMatchObject({ back: 'denizen' })
    })

    it('rows follow the engine’s option order, each card keyed by its option', () => {
        const rows = facedownSeatRows(
            legal.options,
            (id) => facedownPickerState('dreamThief').getPlayerState(id),
            'Dana',
            () => ''
        )
        expect(rows?.map((row) => row.cards.map((card) => card.key))).toEqual([
            ['0', '1'],
            ['2', '3'],
            ['4']
        ])
    })

    it('a seat with no facedown adviser has no row', () => {
        const state = facedownPickerState('dreamThief')
        state.getPlayerState('Mara').advisers = []
        state.getPlayerState('Mara').adviserIds = []
        const choices = powerOf(state, DREAM_THIEF).choices[0]
        expect(rowsOn(state, 'Dana', choices)?.map((row) => row.seat)).toEqual(['Dana', 'Rhys'])
    })

    it("Inquisitor never offers the viewer's own; the Ivory Eye offers them, faced", () => {
        const inquisitor = facedownPickerState('inquisitor')
        expect(rowsOn(inquisitor, 'Dana', powerOf(inquisitor, INQUISITOR).choices[0])).toEqual([
            { seat: 'Rhys', cards: [RHYS_PEEKED, "back: Rhys's facedown adviser 2"] },
            { seat: 'Mara', cards: ["back: Mara's facedown adviser 1"] }
        ])
        const eye = facedownPickerState('ivoryEye')
        expect(rowsOn(eye, 'Dana', powerOf(eye, IVORY_EYE).choices[0])).toEqual(expected.Dana)
    })
})

describe("Dream Thief's two picks share one area", () => {
    const choices = powerOf(facedownPickerState('dreamThief'), DREAM_THIEF).choices
    const [pair] = adviserPairs(choices)

    it('pairs its two specs; Inquisitor and the Ivory Eye have no pair', () => {
        expect(adviserPairs(choices)).toEqual([{ specs: [0, 1] }])
        const inquisitor = facedownPickerState('inquisitor')
        expect(adviserPairs(powerOf(inquisitor, INQUISITOR).choices)).toEqual([])
        const eye = facedownPickerState('ivoryEye')
        expect(adviserPairs(powerOf(eye, IVORY_EYE).choices)).toEqual([])
    })

    const tap = (picks: ReturnType<typeof emptyPicks>, option: number) =>
        withPairTap(pair, choices, picks, option)

    it('a tap fills the first empty pick; a tap on a picked card lets it go, the second moving up', () => {
        let picks = tap(emptyPicks(), 0)
        expect(pairPicked(pair, choices, picks)).toEqual([0])
        picks = tap(picks, 4)
        expect(pairPicked(pair, choices, picks)).toEqual([0, 4])
        expect(picks.option).toEqual({ 0: 0, 1: 4 })
        picks = tap(picks, 0)
        expect(picks.option).toEqual({ 0: 4, 1: NO_OPTION })
        picks = tap(picks, 4)
        expect(pairPicked(pair, choices, picks)).toEqual([])
    })

    it('a tap on the second pick lets only it go', () => {
        const picks = tap(tap(tap(emptyPicks(), 1), 3), 3)
        expect(picks.option).toEqual({ 0: 1, 1: NO_OPTION })
    })

    it('with both picked, a tap on a third card changes nothing', () => {
        const both = tap(tap(emptyPicks(), 1), 3)
        expect(tap(both, 2)).toBe(both)
    })

    it('no run of taps ever makes one card both picks', () => {
        const options = choices[0].options.length
        let frontier = [emptyPicks()]
        for (let step = 0; step < 4; step += 1) {
            frontier = frontier.flatMap((picks) =>
                Array.from({ length: options }, (_, j) => tap(picks, j))
            )
            for (const picks of frontier) {
                const picked = pairPicked(pair, choices, picks)
                expect(new Set(picked).size).toBe(picked.length)
            }
        }
    })

    it('two of one seat’s cards are a pair it can pick', () => {
        expect(pairPicked(pair, choices, tap(tap(emptyPicks(), 2), 3))).toEqual([2, 3])
    })
})

describe('the Ivory Eye waits for a first pick before any refusal shows', () => {
    const eye = powerOf(facedownPickerState('ivoryEye'), IVORY_EYE)

    it('every pick optional and none made: waiting', () => {
        expect(awaitsFirstPick(eye.choices, emptyPicks())).toBe(true)
    })

    it('once anything is picked, or a pick is required, not waiting', () => {
        expect(
            awaitsFirstPick(eye.choices, withOptionPick(emptyPicks(), eye.choices[0], 0, 1))
        ).toBe(false)
        const thief = powerOf(facedownPickerState('dreamThief'), DREAM_THIEF)
        expect(awaitsFirstPick(thief.choices, emptyPicks())).toBe(false)
        expect(awaitsFirstPick([], emptyPicks())).toBe(false)
    })
})
