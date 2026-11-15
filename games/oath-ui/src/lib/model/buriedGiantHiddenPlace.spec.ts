import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, assert, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    PowerMoveKind,
    PowerQuestionKind,
    isTravel,
    type PowerQuestion
} from '@tabletop/oath'
import { openTurn, served, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { describeAction } from './actionDescription.js'
import { chipWords, pickChip, travelChip } from './travelOnTheMap.js'
import { travelRows } from './travelRows.js'
import { travelSpoken } from './travelWords.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const HIDDEN_PLACE = 'site.the-hidden-place'
const STORYTELLER = 'denizen.hearth.storyteller'

type Seat = Partial<Parameters<typeof testPlayer>[0]>

/**
 * Dana stands at the Buried Giant (c1) with 2 faceup secrets; The Hidden Place is h2, 4 Supply away
 * in the Hinterland. Rhys holds a facedown adviser, so Dana's view does not hold everything.
 */
function giant(dana: Seat = {}, oathRevision: number = CURRENT_OATH_REVISION) {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 5,
                warbandsOnBoard: { dana: 3 },
                ...dana
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'p1',
                favor: 2,
                secrets: 1,
                secretsFacedown: 1,
                advisers: [{ cardId: STORYTELLER, faceUp: false }]
            })
        ],
        {
            oathRevision,
            machineState: MachineState.ActPhase,
            denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], h2: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.buried-giant',
                c2: 'site.river',
                p1: 'site.marshes',
                p2: 'site.mine',
                h1: 'site.mountain',
                h2: HIDDEN_PLACE
            }
        }
    )
    openTurn(state, 'dana')
    return state
}

const view = (state: HydratedOathGameState) =>
    new HydratedOathGameState(served(state, { kind: 'player', playerId: 'dana' }))
/** The Hidden Place's ways, as Dana's own view and the server's both price them. */
function hiddenWays(state: HydratedOathGameState) {
    const read = (s: HydratedOathGameState) =>
        travelRows(s, 'dana', []).find((row) => row.slotId === 'h2')
    const own = read(view(state))
    expect(own).toEqual(read(state))
    return own
}
/** A Travel to The Hidden Place as recorded. */
function recorded(fields: Record<string, unknown>): GameAction {
    const travel: { type: ActionType; playerId: string } & Record<string, unknown> = {
        type: ActionType.Travel,
        playerId: 'dana',
        siteId: 'h2',
        ...fields
    }
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...travel }
}
const names = {
    player: (id: string) => id,
    site: () => 'The Hidden Place',
    seats: ['dana', 'rhys']
}

describe('R-11.13-H2 — from the Buried Giant, The Hidden Place reads "N+[secret]" and "0+[secret][secret]"', () => {
    it('with the Supply, two ways: pay 4 and flip one, or flip two for free', () => {
        const row = hiddenWays(giant())
        assert(row !== undefined, 'The Hidden Place is lit')
        expect(row.ways.map((way) => [way.cost, way.flipSecret])).toEqual([
            [4, true],
            [0, 2]
        ])
        const chip = travelChip(row.ways)
        expect(chip).toEqual({
            ways: [
                { cost: 4, favor: 0, secrets: 1 },
                { cost: 0, favor: 0, secrets: 2 }
            ]
        })
        expect(chip ? chipWords(chip) : undefined).toBe(
            '4 Supply + 1 secret or 0 Supply + 2 secrets'
        )
        const nameOf = (id: string) => id
        expect(row.ways.map((way) => travelSpoken(row, way, nameOf))).toEqual([
            'Travel to The Hidden Place: spend 4 Supply, flip a secret facedown',
            'Travel to The Hidden Place: spend no Supply, flip 2 secrets facedown'
        ])
    })

    it('with too little Supply, only the free way; with one faceup secret too, The Hidden Place is not lit', () => {
        const row = hiddenWays(giant({ supply: 3 }))
        expect(row?.ways.map((way) => [way.cost, way.flipSecret])).toEqual([[0, 2]])
        expect(row ? travelChip(row.ways) : undefined).toEqual({
            ways: [{ cost: 0, favor: 0, secrets: 2 }]
        })
        expect(hiddenWays(giant({ supply: 3, secrets: 1, secretsFacedown: 1 }))).toBeUndefined()
    })

    it('every other destination keeps its ways: the Supply, or one secret for none', () => {
        const row = travelRows(view(giant({ supply: 3 })), 'dana', []).find(
            (r) => r.slotId === 'h1'
        )
        expect(row?.ways.map((way) => [way.cost, way.flipSecret])).toEqual([[0, true]])
        expect(row ? travelChip(row.ways) : undefined).toEqual({
            ways: [{ cost: 0, favor: 0, secrets: 1 }]
        })
    })

    it('Toll Roads\' favor rides along on both ways: "4+[favor][secret] or 0+[favor][secret][secret]"', () => {
        const state = giant()
        state.denizensBySite['h2'] = ['denizen.order.toll-roads']
        state.warbandsBySite['h2'] = { rhys: 1 }
        const row = hiddenWays(state)
        assert(row !== undefined, 'The Hidden Place is lit')
        expect(row.ways.map((way) => [way.cost, way.tolls.length, way.flipSecret])).toEqual([
            [4, 1, true],
            [0, 1, 2]
        ])
        expect(travelChip(row.ways)).toEqual({
            ways: [
                { cost: 4, favor: 1, secrets: 1 },
                { cost: 0, favor: 1, secrets: 2 }
            ]
        })
        expect(travelSpoken(row, row.ways[1], (id) => id)).toBe(
            'Travel to The Hidden Place: spend no Supply, give 1 favor to rhys (Toll Roads), flip 2 secrets facedown'
        )
    })

    it('the free way is sent with both flips', async () => {
        const session = await openSessionOn(tableOf(giant()))
        const sent = vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.Travel)
        const ways = session.travelRows.find((row) => row.slotId === 'h2')?.ways ?? []
        expect(ways.map((way) => way.flipSecret)).toEqual([true, 2])
        await session.travelTo('h2', ways[1])
        const action = sent.mock.calls[0][0]
        assert(isTravel(action), 'a Travel is sent')
        expect(action.flipSecret).toBe(2)
    })

    it('R-X.4 — before revision 20 one way, free with one flip, as recorded', () => {
        const row = hiddenWays(giant({ supply: 3 }, OathRevision.EngineFixes15))
        expect(row?.ways.map((way) => [way.cost, way.flipSecret])).toEqual([[0, true]])
    })

    it('the History names each flip', () => {
        expect(
            describeAction(
                recorded({
                    flipSecret: 2,
                    metadata: { supplySpent: 0, supplyRemaining: 5, secretFlipped: 2 }
                }),
                names
            )
        ).toBe('traveled to The Hidden Place; flipped 2 secrets')
        expect(
            describeAction(
                recorded({
                    flipSecret: true,
                    metadata: { supplySpent: 4, supplyRemaining: 1, secretFlipped: true }
                }),
                names
            )
        ).toBe('traveled to The Hidden Place, spending 4 Supply; flipped 1 secret')
    })
})

describe("R-11.13-H2 — a power's move from the Buried Giant past the Narrow Pass into The Hidden Place asks two", () => {
    const flipQuestion = (flips?: 2): PowerQuestion => ({
        kind: PowerQuestionKind.FlipToTravel,
        cardId: 'relic.whistle',
        askedPlayerId: 'dana',
        move: PowerMoveKind.Whistle,
        powerCardId: 'relic.whistle',
        moverPlayerId: 'rhys',
        fromSiteId: 'c1',
        siteId: 'h2',
        ...(flips ? { flips } : {})
    })
    async function asked(question: PowerQuestion, dana: Seat = {}) {
        const state = giant(dana)
        state.siteCards['h1'] = 'site.narrow-pass'
        state.machineState = MachineState.PowerQuestion
        state.pendingQuestions = {
            queue: [question],
            askingPlayerId: 'rhys',
            resumeMachineState: MachineState.ActPhase
        }
        const session = await openSessionOn(tableOf(state))
        const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
        return { draft: session.question, sent }
    }

    it('Travel sends the flip of both; with one faceup secret the engine refuses it and says why', async () => {
        const { draft, sent } = await asked(flipQuestion(2))
        expect(draft.acceptRefusedBecause).toBeUndefined()
        await draft.accept()
        expect(sent).toHaveBeenCalledWith({ kind: PowerQuestionKind.FlipToTravel, flip: true })
        const short = await asked(flipQuestion(2), { secrets: 1, secretsFacedown: 1 })
        expect(short.draft.acceptRefusedBecause).toBe(
            'flipping 2 secrets takes 2 faceup secrets: you have 1'
        )
    })

    it("the Brass Horse's map chip shows both secrets, and its answer carries both", async () => {
        const horse: PowerQuestion = {
            kind: PowerQuestionKind.TravelFreeTo,
            cardId: 'relic.brass-horse',
            askedPlayerId: 'dana',
            siteIds: ['h2', 'p2']
        }
        const { draft, sent } = await asked(horse)
        expect(draft.travelFlipsAt('h2')).toBe(2)
        const site = draft.travelPick?.sites.find((s) => s.siteId === 'h2')
        expect(site ? pickChip(site) : undefined).toEqual({ free: { toll: false, secrets: 2 } })
        expect(chipWords({ free: { toll: false, secrets: 2 } })).toBe('flip 2 secrets')
        await draft.travelTo('h2')
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.TravelFreeTo,
            siteId: 'h2',
            flipSecret: 2
        })
    })
})
