import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerQuestionKind,
    PowerTiming,
    payableWoodPicks,
    powerIndexOf,
    type PowerQuestion
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const ME = 'me'
const DANA = 'dana'
const PATHS = 'denizen.beast.forest-paths'
const pathsUse = { cardId: PATHS, powerIndex: powerIndexOf(PATHS, PowerTiming.Modifier) }

/**
 * I rule the Shrouded Wood at p1, where Dana (1 Supply, their Forest Paths' favor already placed)
 * declared Forest Paths; c1 holds a Beast card.
 */
function asked(cards: boolean) {
    const question: PowerQuestion = {
        kind: PowerQuestionKind.ShroudedWoodDestination,
        cardId: 'site.shrouded-wood',
        askedPlayerId: ME,
        travelerPlayerId: DANA,
        fromSiteId: 'p1',
        travel: cards ? { free: false, modifiers: [pathsUse] } : { free: false }
    }
    const state = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'h1', favor: 2, warbandsOnBoard: { [ME]: 3 } }),
            testPlayer({ playerId: DANA, color: Color.Blue, siteId: 'p1', supply: 1, favor: 0, advisers: [{ cardId: PATHS, faceUp: true }] }),
            testPlayer({ playerId: 'bea', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2' })
        ],
        {
            oathRevision: OathRevision.EngineFixes11,
            chancellorPlayerId: 'bea',
            machineState: MachineState.PowerQuestion,
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.shrouded-wood', h1: 'site.mountain' },
            denizensBySite: { c1: ['denizen.beast.wolves'], c2: [], p1: [], h1: [] },
            warbandsBySite: { p1: { [ME]: 1 } },
            pendingQuestions: { queue: [question], askingPlayerId: DANA, resumeMachineState: MachineState.ActPhase }
        }
    )
    const session = openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'answerQuestion').mockResolvedValue()
    return { session, draft: session.question, sent, question }
}

describe('R-11.7-H2 — the Shrouded Wood’s ruler is offered what the engine accepts, with the declared cards counted', () => {
    it('Forest Paths declared: only the Beast site, as the engine prices it, and nothing else is sent', async () => {
        const { session, draft, sent, question } = asked(true)
        const travel = question.kind === PowerQuestionKind.ShroudedWoodDestination ? question.travel : undefined
        expect(travel).toBeDefined()
        const engineSites = payableWoodPicks(session.gameState, DANA, travel ?? { free: false }).map((pick) => pick.siteId)
        expect(engineSites).toEqual(['c1'])
        expect(draft.woodDestinations).toEqual(engineSites)
        await draft.sendThrough('c2')
        expect(sent).not.toHaveBeenCalled()
        await draft.sendThrough('c1')
        expect(sent).toHaveBeenCalledWith({ kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })
    })

    it('control: with no card counted, every site costs 2 and none is offered', () => {
        const { draft } = asked(false)
        expect(draft.woodDestinations).toEqual([])
    })
})
