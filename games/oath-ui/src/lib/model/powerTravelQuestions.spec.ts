import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerMoveKind,
    PowerQuestionKind,
    type PowerQuestion
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const HIDDEN_PLACE = 'site.the-hidden-place'

type Seat = Partial<Parameters<typeof testPlayer>[0]>

/** I stand at c1; The Hidden Place is c2; Ann rules the Shrouded Wood at h1, where Bo stands. */
async function asked(
    question: PowerQuestion,
    me: Seat = {},
    oathRevision: number = OathRevision.EngineFixes11
) {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                favor: 4,
                secrets: 2,
                ...me
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                siteId: 'p1',
                favor: 2,
                warbandsOnBoard: { ann: 2 }
            }),
            testPlayer({ playerId: 'bo', color: Color.Yellow, siteId: 'h1', favor: 2 }),
            testPlayer({
                playerId: 'bea',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p1'
            })
        ],
        {
            oathRevision,
            chancellorPlayerId: 'bea',
            machineState: MachineState.PowerQuestion,
            siteCards: {
                c1: 'site.plains',
                c2: HIDDEN_PLACE,
                p1: 'site.marshes',
                h1: 'site.shrouded-wood'
            },
            warbandsBySite: { h1: { ann: 2 } },
            pendingQuestions: {
                queue: [question],
                askingPlayerId: ME,
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, draft: session.question, sent }
}

const flipQuestion = (): PowerQuestion => ({
    kind: PowerQuestionKind.FlipToTravel,
    cardId: 'relic.whistle',
    askedPlayerId: ME,
    move: PowerMoveKind.Whistle,
    powerCardId: 'relic.whistle',
    moverPlayerId: 'ann',
    fromSiteId: 'c1',
    siteId: 'c2'
})

const horse = (): PowerQuestion => ({
    kind: PowerQuestionKind.TravelFreeTo,
    cardId: 'relic.brass-horse',
    askedPlayerId: ME,
    siteIds: ['c2', 'p1']
})

describe('The Hidden Place — "Travel to The Hidden Place?": Travel · flip 1 [secret] / Stay', () => {
    it('Travel sends the flip, and Stay its refusal', async () => {
        const { draft, sent } = await asked(flipQuestion())
        expect(draft.acceptComplete).toBe(true)
        expect(draft.acceptRefusedBecause).toBeUndefined()
        await draft.accept()
        expect(sent).toHaveBeenCalledWith({ kind: PowerQuestionKind.FlipToTravel, flip: true })
        await draft.decline()
        expect(sent).toHaveBeenLastCalledWith({ kind: PowerQuestionKind.FlipToTravel, flip: false })
    })

    it('with no faceup secret left, the engine refuses the flip and says why', async () => {
        const { draft } = await asked(flipQuestion(), { secrets: 0 })
        expect(draft.acceptRefusedBecause).toBe('you have no faceup secret to flip')
    })
})

describe('the Brass Horse offers The Hidden Place with its flip', () => {
    it('marks The Hidden Place alone as flipping, and its answer carries the flip', async () => {
        const { draft, sent } = await asked(horse())
        expect(draft.travelFlipsAt('c2')).toBe(1)
        expect(draft.travelFlipsAt('p1')).toBe(0)
        await draft.travelTo('c2')
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.TravelFreeTo,
            siteId: 'c2',
            flipSecret: true
        })
        await draft.travelTo('p1')
        expect(sent).toHaveBeenLastCalledWith({
            kind: PowerQuestionKind.TravelFreeTo,
            siteId: 'p1'
        })
    })

    it('in a game created before revision 15 nothing flips', async () => {
        const { draft } = await asked(horse(), {}, OathRevision.EngineFixes10)
        expect(draft.travelFlipsAt('c2')).toBe(0)
    })
})

describe("the Shrouded Wood's ruler after the Brass Horse picks only among the Horse's sites", () => {
    const pick = (siteIds?: string[]): PowerQuestion => ({
        kind: PowerQuestionKind.ShroudedWoodDestination,
        cardId: 'site.shrouded-wood',
        askedPlayerId: ME,
        travelerPlayerId: 'bo',
        fromSiteId: 'h1',
        ...(siteIds
            ? { power: { powerCardId: 'relic.brass-horse', userPlayerId: 'bo', siteIds } }
            : {})
    })

    it('offers the allowed sites and sends nothing for another', async () => {
        const { draft, sent } = await asked(pick(['c2', 'p1']))
        expect(draft.woodDestinations).toEqual(['c2', 'p1'])
        await draft.sendThrough('c1')
        expect(sent).not.toHaveBeenCalled()
        await draft.sendThrough('p1')
        expect(sent).toHaveBeenCalledWith({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            siteId: 'p1'
        })
    })

    it('after the Whistle (no set) every site the pawn can travel to', async () => {
        const { draft } = await asked(pick())
        expect(draft.woodDestinations).toEqual(expect.arrayContaining(['c1', 'c2', 'p1']))
        expect(draft.woodDestinations).not.toContain('h1')
    })
})
