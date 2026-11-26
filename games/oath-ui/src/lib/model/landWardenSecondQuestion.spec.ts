import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    HydratedSearch,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerTiming,
    Search,
    SearchPlay,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." Both
// cards go in one Search resolution, so the second card is chosen before the kept card's play. A player who
// pressed "To your site" first saw the Search resolve and the other card discarded (bug report, Oath UI 4.8.0):
// the second card is now a question answered before the kept card's play is offered.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const CONQUEST = 'vision.conquest'

const VISION_KEY = `${CONQUEST}|${SearchPlay.RevealedVision}|`

/**
 * Round 3, Dana's Act Phase. Dana, an Exile at the Great Slum (c1, capacity 3, one card there), has searched the
 * world deck, with Land Warden as an adviser, if `warden`; the draw stops at the Vision of Conquest (Law 5.1.2).
 */
function searched({ warden = true }: { warden?: boolean } = {}): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: warden ? [{ cardId: LAND_WARDEN, faceUp: true }] : []
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 2,
                secrets: 1,
                warbandsInPersonalBank: { rhys: 5 }
            })
        ],
        {
            oathRevision: OathRevision.EngineFixes27,
            round: 3,
            denizensBySite: { c1: [WOLVES], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(state, 'dana')
    state.requireVault().worldDeck = [ALCHEMIST, CONQUEST, LONGBOWS]
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: warden
                ? [
                      {
                          cardId: LAND_WARDEN,
                          powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier)
                      }
                  ]
                : []
        })
    ).apply(state)
    // R-5.1.3 — the drawn cards wait to be kept, as the turn's handler leaves the table after a Search.
    state.machineState = MachineState.Searching
    return state
}

async function keptAlchemist(table = searched()) {
    const session = await openSessionOn(tableOf(table))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    const draft = session.search
    draft.keep(ALCHEMIST)
    return { session, draft, sent }
}

describe('Land Warden: the second card is asked before the kept card is played', () => {
    it('a kept card with a second card to offer waits for the second-card answer', async () => {
        const { draft } = await keptAlchemist()
        expect(draft.secondCandidates).toEqual([CONQUEST])
        expect(draft.needsSecondAnswer).toBe(true)
    })

    it('"To your site" pressed before the answer is refused, and nothing is played or discarded', async () => {
        const { draft, sent } = await keptAlchemist()
        await expect(draft.choosePlacement({ play: SearchPlay.Site })).rejects.toThrow()
        expect(sent).not.toHaveBeenCalled()
        expect(draft.placement).toBeUndefined()
        expect(draft.needsSecondAnswer).toBe(true)
    })

    it('the Vision picked second: "To your site" plays both', async () => {
        const { session, draft, sent } = await keptAlchemist()
        draft.setSecondPlay(VISION_KEY)
        expect(draft.needsSecondAnswer).toBe(false)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
        const [choice] = sent.mock.calls[0]
        expect(choice).toEqual({
            keptCardId: ALCHEMIST,
            discardOrder: [],
            play: SearchPlay.Site,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision }
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
        ).toBeUndefined()
    })

    it('"No second card": "To your site" plays the kept card and discards the Vision', async () => {
        const { draft, sent } = await keptAlchemist()
        draft.declineSecond()
        expect(draft.needsSecondAnswer).toBe(false)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
        expect(sent.mock.calls[0][0]).toEqual({
            keptCardId: ALCHEMIST,
            discardOrder: [CONQUEST],
            play: SearchPlay.Site
        })
    })

    it('the second card dropped again: the question is asked again', async () => {
        const { draft } = await keptAlchemist()
        draft.setSecondPlay(VISION_KEY)
        draft.setSecondPlay(undefined)
        expect(draft.needsSecondAnswer).toBe(true)
    })

    it('Undo after "No second card" asks the question again', async () => {
        const { draft } = await keptAlchemist()
        draft.declineSecond()
        expect(draft.back()).toBe(true)
        expect(draft.kept).toBe(ALCHEMIST)
        expect(draft.needsSecondAnswer).toBe(true)
    })

    it('Undo takes back the answer with the picks beside the play, as one step', async () => {
        const { draft } = await keptAlchemist()
        draft.declineSecond()
        draft.setDiscardFirst(WOLVES)
        expect(draft.back()).toBe(true)
        expect(draft.discardFirsts).toEqual([])
        expect(draft.needsSecondAnswer).toBe(true)
        expect(draft.kept).toBe(ALCHEMIST)
    })

    it('control: without Land Warden nothing is asked, and "To your site" plays at once', async () => {
        const { draft, sent } = await keptAlchemist(searched({ warden: false }))
        expect(draft.needsSecondAnswer).toBe(false)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
    })
})
