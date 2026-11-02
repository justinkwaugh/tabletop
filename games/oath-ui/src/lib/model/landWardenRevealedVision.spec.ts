import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import {
    HydratedSearch,
    HydratedSearchResolve,
    MachineState,
    OathRevision,
    OathVisibility,
    PlayerStatus,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    powerIndexOf,
    type HydratedOathGameState,
    type SearchResolveChoice
} from '@tabletop/oath'
import { buildAction, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { PLAY_LABELS } from './adviserPlacements.js'
import { describeAction } from './actionDescription.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." A Search
// plays its card to the Revealed Vision space if its player is an Exile (Law 5.1.4, step 4). From revision 32 an
// Exile's Vision drawn with Land Warden is offered as the second card "as your Vision", the kept card's words in the
// row's lower case, beside "adviser, facedown"; the History names it as the kept card's play is named.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const CONQUEST = 'vision.conquest'
const FAITH = 'vision.faith'

const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26

const AS_YOUR_VISION = 'as your Vision'
const VISION_KEY = `${CONQUEST}|${SearchPlay.RevealedVision}|`

/**
 * Round 3, Dana's Act Phase. Dana (an Exile unless `status` says) stands at the Great Slum (c1, capacity 3), full
 * with the Wolves, the Tents and Tavern Songs, and has Land Warden faceup as an adviser. Rhys is at the River.
 * Dana has searched the world deck with Land Warden declared: Alchemist, then the Vision of Conquest, where the draw
 * stops (Law 5.1.2).
 */
function searched(
    oathRevision: OathRevision,
    { status, revealed }: { status?: PlayerStatus; revealed?: string } = {}
): HydratedOathGameState {
    const state = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                ...(status ? { status } : {}),
                ...(revealed ? { revealedVisionId: revealed } : {}),
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2',
                favor: 2,
                secrets: 1
            })
        ],
        {
            oathRevision,
            round: 3,
            denizensBySite: { c1: [WOLVES, TENTS, SONGS], c2: [], p1: [], h1: [] },
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

/** Alchemist kept, the Wolves picked to discard first at the full Great Slum. */
async function alchemistKept(state: HydratedOathGameState) {
    const opened = await searchDraftOn(state)
    expect(opened.session.gameState.getPlayerState('dana').knownHand()).toEqual([
        ALCHEMIST,
        CONQUEST
    ])
    opened.draft.keep(ALCHEMIST)
    opened.draft.setDiscardFirst(WOLVES)
    expect(opened.draft.discardFirst).toBe(WOLVES)
    return opened
}

describe("from revision 32, Land Warden's second card as an Exile's Vision", () => {
    it('with Alchemist kept, the Vision of Conquest lists "adviser, facedown" and "as your Vision"', async () => {
        const { draft } = await alchemistKept(searched(FIXED))
        expect(draft.secondCandidates).toEqual([CONQUEST])
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown', AS_YOUR_VISION])
    })

    it('"as your Vision" is the kept Vision\'s own "As your Vision", in the row\'s lower case', async () => {
        const { draft } = await searchDraftOn(searched(FIXED))
        draft.keep(CONQUEST)
        const kept = draft.placements.find((o) => o.play === SearchPlay.RevealedVision)?.label
        expect(kept).toBe(PLAY_LABELS[SearchPlay.RevealedVision])
        expect(kept).toBe('As your Vision')
        expect(AS_YOUR_VISION).toBe(`a${kept?.slice(1)}`)
    })

    it('a Citizen\'s Vision lists only "adviser, facedown"', async () => {
        const { draft } = await alchemistKept(searched(FIXED, { status: PlayerStatus.Citizen }))
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown'])
    })

    it('picked, the kept card is offered only to the site, which sends the Vision as the second play; the engine accepts it', async () => {
        const { session, draft, sent } = await alchemistKept(searched(FIXED))
        draft.setSecondPlay(VISION_KEY)
        expect(draft.second).toMatchObject({
            cardId: CONQUEST,
            play: SearchPlay.RevealedVision,
            mode: AS_YOUR_VISION
        })
        expect(draft.placements.map((option) => option.play)).toEqual([SearchPlay.Site])
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(sent).toHaveBeenCalledTimes(1)
        const [choice] = sent.mock.calls[0]
        expect(choice).toEqual({
            keptCardId: ALCHEMIST,
            discardOrder: [],
            play: SearchPlay.Site,
            discardFirstCardId: WOLVES,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision }
        })
        expect(
            HydratedSearchResolve.reasonCannotResolve(session.gameState, 'dana', choice)
        ).toBeUndefined()
    })

    it('with a Vision already revealed it is still offered: the new one replaces it (R-5.1.4.III)', async () => {
        const { draft } = await alchemistKept(searched(FIXED, { revealed: FAITH }))
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown', AS_YOUR_VISION])
    })
})

describe('before revision 32 the Vision is offered as it was', () => {
    it('only "adviser, facedown", as the engine refuses the Revealed Vision space there', async () => {
        const { draft } = await alchemistKept(searched(BEFORE))
        expect(modesOf(draft, CONQUEST)).toEqual(['adviser, facedown'])
    })
})

describe('the History names the Vision revealed second', () => {
    /** The resolve applied by the engine, as recorded. */
    function recorded(state: HydratedOathGameState, choice: SearchResolveChoice): GameAction {
        const action = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'dana', ...choice })
        )
        action.apply(state)
        return action.dehydrate()
    }

    const ALCHEMIST_TO_SITE = {
        keptCardId: ALCHEMIST,
        discardOrder: [],
        play: SearchPlay.Site,
        discardFirstCardId: WOLVES
    }

    async function linesFor(choice: SearchResolveChoice) {
        const state = searched(FIXED)
        const session = await openSessionOn(tableOf(state))
        const record = recorded(state, choice)
        const seen = (viewer: string) =>
            describeAction(
                OathVisibility.actions.project(record, { kind: 'player', playerId: viewer }),
                session.historyNames,
                viewer
            )
        return { rhys: seen('rhys'), dana: seen('dana') }
    }

    it('"; revealed Vision of Conquest as their Vision", to every seat', async () => {
        const lines = await linesFor({
            ...ALCHEMIST_TO_SITE,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision }
        })
        const line =
            'kept Alchemist and played it to their site, discarding Wolves first, gaining 1 favor; revealed Vision of Conquest as their Vision'
        expect(lines.rhys).toBe(`${line}; 1 card went to the provinces discard pile`)
        expect(lines.dana).toBe(`${line}; Wolves went to the provinces discard pile`)
    })

    it('control: the Vision second as a facedown adviser adds no clause and names no card', async () => {
        const lines = await linesFor({
            ...ALCHEMIST_TO_SITE,
            secondPlay: { cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }
        })
        const line =
            'kept Alchemist and played it to their site, discarding Wolves first, gaining 1 favor'
        expect(lines.rhys).toBe(`${line}; 1 card went to the provinces discard pile`)
        expect(lines.dana).toBe(`${line}; Wolves went to the provinces discard pile`)
        expect(lines.rhys).not.toContain('Vision of Conquest')
    })
})
