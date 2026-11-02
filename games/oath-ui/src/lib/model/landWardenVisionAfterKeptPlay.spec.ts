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

// Land Warden's second card is played after the kept card's play, on the state that play leaves, so a Vision second
// "as your Vision" is offered where the engine accepts it on that state: Secret Police kept to a site its ruler's
// enemy stands on refuses it ("Enemies cannot play Visions faceup while their pawn is at any site ruled by Secret
// Police's ruler"), and Secret Police discarded first by the kept card's play no longer does.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const BEWITCH = 'denizen.arcane.bewitch'
const SECRET_POLICE = 'denizen.order.secret-police'
const CONQUEST = 'vision.conquest'

const AS_YOUR_VISION = 'as your Vision'
const VISION_KEY = `${CONQUEST}|${SearchPlay.RevealedVision}|`
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
            oathRevision: OathRevision.EngineFixes27,
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

describe("Land Warden: the Vision second is offered on the state the kept card's play leaves", () => {
    it('Secret Police kept to the Great Slum Rhys rules: "as your Vision" is not offered', async () => {
        const { draft } = await searchDraftOn(
            searched({ top: [SECRET_POLICE, CONQUEST, LONGBOWS], c1Warbands: ruledByRhys })
        )
        draft.keep(SECRET_POLICE)
        draft.setDiscardFirst(WOLVES)
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown'])
    })

    it('control: Secret Police kept to the Great Slum Dana rules: "as your Vision" is offered', async () => {
        const { draft } = await searchDraftOn(
            searched({ top: [SECRET_POLICE, CONQUEST, LONGBOWS] })
        )
        draft.keep(SECRET_POLICE)
        draft.setDiscardFirst(WOLVES)
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown', AS_YOUR_VISION])
    })

    it('Secret Police at the Great Slum Rhys rules: "as your Vision" is offered once it is picked to go first, not for another card', async () => {
        const { session, draft, sent } = await searchDraftOn(
            searched({ c1: [SECRET_POLICE, TENTS, SONGS], c1Warbands: ruledByRhys })
        )
        draft.keep(ALCHEMIST)
        draft.setDiscardFirst(TENTS)
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown'])
        draft.setDiscardFirst(SECRET_POLICE)
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown', AS_YOUR_VISION])
        draft.setSecondPlay(VISION_KEY)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
        const [choice] = sent.mock.calls[0]
        expect(choice).toEqual({
            keptCardId: ALCHEMIST,
            discardOrder: [],
            play: SearchPlay.Site,
            discardFirstCardId: SECRET_POLICE,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision }
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
        ).toBeUndefined()
    })

    it('Bewitch kept: "as your Vision" is still offered, as Bewitch may leave Dana an Exile', async () => {
        const { draft } = await searchDraftOn(searched({ top: [BEWITCH, CONQUEST, LONGBOWS] }))
        draft.keep(BEWITCH)
        draft.setDiscardFirst(WOLVES)
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown', AS_YOUR_VISION])
    })
})

// Bewitch: "When played, if you're an Exile and have more secrets (even on cards) than the Chancellor, you may become
// a Citizen". A Citizen plays no Vision faceup (Law 5.1.4.III), and the second card is played after Bewitch's power,
// so with the Vision "as your Vision" the yes cannot be taken and is not asked: Dana stays an Exile.
describe('Land Warden: Bewitch kept with the Vision second', () => {
    const bewitchKept = async () => {
        const opened = await searchDraftOn(searched({ top: [BEWITCH, CONQUEST, LONGBOWS] }))
        opened.draft.keep(BEWITCH)
        opened.draft.setDiscardFirst(WOLVES)
        return opened
    }
    const asksCitizen = (draft: {
        whenPlayed: { spec: { what?: string }; options: unknown[] }[]
    }) => draft.whenPlayed.some((c) => c.spec.what === 'becoming a Citizen' && c.options.length > 0)

    it('"as your Vision": "becoming a Citizen" is not asked, and the play goes on with Dana an Exile', async () => {
        const { session, draft, sent } = await bewitchKept()
        draft.setSecondPlay(VISION_KEY)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(asksCitizen(draft)).toBe(false)
        expect(draft.needsWhenPlayed).toBe(false)
        expect(sent).toHaveBeenCalledTimes(1)
        const [choice] = sent.mock.calls[0]
        expect(choice).toEqual({
            keptCardId: BEWITCH,
            discardOrder: [],
            play: SearchPlay.Site,
            discardFirstCardId: WOLVES,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision }
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
        ).toBeUndefined()
    })

    it('the Vision "adviser, facedown": "becoming a Citizen" is still asked', async () => {
        const { draft, sent } = await bewitchKept()
        draft.setSecondPlay(FACEDOWN_KEY)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(asksCitizen(draft)).toBe(true)
        expect(sent).not.toHaveBeenCalled()
    })

    it('no second card: "becoming a Citizen" is still asked', async () => {
        const { draft, sent } = await bewitchKept()
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.needsWhenPlayed).toBe(true)
        expect(asksCitizen(draft)).toBe(true)
        expect(sent).not.toHaveBeenCalled()
    })
})
