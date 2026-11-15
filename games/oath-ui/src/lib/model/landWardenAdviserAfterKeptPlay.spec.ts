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

// Land Warden's second card is played after the kept card's play, on the state that play leaves, so a second card
// "adviser, facedown" is offered where the engine accepts it on that state: Gossip ("Enemies of Gossip's ruler cannot
// play cards as facedown advisers") at the Great Slum Rhys rules refuses it, and Gossip discarded first by the kept
// card's play no longer does.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const GOSSIP = 'denizen.discord.gossip'
const CONQUEST = 'vision.conquest'

const FACEDOWN = 'adviser, facedown'
const AS_YOUR_VISION = 'as your Vision'
const FACEDOWN_KEY = `${CONQUEST}|${SearchPlay.Adviser}|false`

interface Table {
    /** The Great Slum's cards (capacity 3). */
    c1?: string[]
    /** The warbands at the Great Slum: its ruler. */
    c1Warbands?: Record<string, number>
    /** The world deck's top three. */
    top?: string[]
}

/**
 * Round 3, Dana's Act Phase. Dana, an Exile, stands at the Great Slum (c1, capacity 3), which is full, and has Land
 * Warden faceup as an adviser. Rhys, the Chancellor, is at the River. Dana has searched the world deck with Land
 * Warden declared; the draw stops at the Vision of Conquest (Law 5.1.2).
 */
function searched({
    c1 = [WOLVES, TENTS, SONGS],
    c1Warbands = { dana: 1 },
    top = [ALCHEMIST, CONQUEST, LONGBOWS]
}: Table = {}): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
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
            oathRevision: OathRevision.EngineFixes28,
            round: 3,
            denizensBySite: { c1, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: c1Warbands },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    openTurn(state, 'dana')
    state.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: 'dana',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [
                {
                    cardId: LAND_WARDEN,
                    powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier)
                }
            ]
        })
    ).apply(state)
    // R-5.1.3 — the drawn cards wait to be kept, as the turn's handler leaves the table after a Search.
    state.machineState = MachineState.Searching
    return state
}

async function searchDraftOn(state: HydratedOathGameState) {
    const session = await openSessionOn(tableOf(state))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

const modesOf = (draft: { secondPlays: { cardId: string; mode: string }[] }, cardId: string) =>
    draft.secondPlays.filter((o) => o.cardId === cardId).map((o) => o.mode)

const ruledByRhys = { rhys: 2 }

describe("Land Warden: the second card facedown is offered on the state the kept card's play leaves", () => {
    it('Gossip at the Great Slum Rhys rules: "adviser, facedown" is offered once Gossip is picked to go first, not for another card', async () => {
        const { session, draft, sent } = await searchDraftOn(
            searched({ c1: [GOSSIP, TENTS, SONGS], c1Warbands: ruledByRhys })
        )
        draft.keep(ALCHEMIST)
        draft.setDiscardFirst(TENTS)
        expect(modesOf(draft, CONQUEST)).toEqual([AS_YOUR_VISION])
        draft.setDiscardFirst(GOSSIP)
        expect(modesOf(draft, CONQUEST)).toEqual([FACEDOWN, AS_YOUR_VISION])
        draft.setSecondPlay(FACEDOWN_KEY)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
        const [choice] = sent.mock.calls[0]
        expect(choice).toEqual({
            keptCardId: ALCHEMIST,
            discardOrder: [],
            play: SearchPlay.Site,
            discardFirstCardId: GOSSIP,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
        ).toBeUndefined()
    })

    it('control: Gossip at the Great Slum Dana rules: "adviser, facedown" is offered', async () => {
        const { draft } = await searchDraftOn(searched({ c1: [GOSSIP, TENTS, SONGS] }))
        draft.keep(ALCHEMIST)
        draft.setDiscardFirst(TENTS)
        expect(modesOf(draft, CONQUEST)).toEqual([FACEDOWN, AS_YOUR_VISION])
    })
})
