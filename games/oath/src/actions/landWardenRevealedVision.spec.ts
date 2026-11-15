import { describe, expect, it } from 'vitest'
import {
    assertExists,
    Color,
    latestPlayerUndoTarget,
    type GameAction,
    type Visibility
} from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { Banner, PlayerStatus, Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testBanners, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, TENTS } from '../testing/cards.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { FALSE_PROPHET_ID } from '../util/revealedVision.js'
import { wakePhaseWin } from '../util/victory.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." A Search
// plays its card "to your site, your advisers, or your Revealed Vision space if you are an Exile" (Law 5.1.4, step
// 4), and Law 5.1.4.III: "Visions cannot be played to a site. The Chancellor and Citizens cannot play Vision cards
// faceup except for the Conspiracy". So from revision 32 an Exile's Vision drawn with Land Warden may be the second
// card, played to the Revealed Vision space while the kept card goes to a site. Before it, a game keeps the plays it
// was recorded with: the second card to a site or as an adviser.

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const RANGERS = 'denizen.beast.rangers'
const CONQUEST = 'vision.conquest'
const FAITH = 'vision.faith'

const DANA = 'dana'
const FIXED = OathRevision.EngineFixes27
const BEFORE = OathRevision.EngineFixes26

const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }
const rhys: Visibility.Perspective = { kind: 'player', playerId: 'rhys' }

const NOT_THIS_PLAY = 'the second card is played to your site or as an adviser'
const NO_SITE = 'Land Warden: at least one of the two cards must be played to a site'

interface Table {
    revision?: OathRevision
    status?: PlayerStatus
    /** The Vision already on Dana's Revealed Vision space. */
    revealed?: string
    /** Dana's other faceup advisers, beside Land Warden. */
    advisers?: string[]
    /** The world deck's top three. */
    top?: string[]
    /** Dana holds the People's Favor. */
    favor?: boolean
    /** Dana holds the Darkest Secret. */
    darkestSecret?: boolean
    visionsDrawn?: number
    /** Rhys's warbands on the Vision Dana has revealed (False Prophet). */
    prophesied?: number
}

/**
 * Dana (an Exile unless `status` says) stands at c1, the Great Slum (capacity 3), which holds the Wolves, the Tents
 * and Tavern Songs, so it is full. Dana has Land Warden faceup as an adviser and searches the world deck with it
 * declared. The deck's top is Alchemist, the Vision of Conquest, then Longbows: the draw stops at the Vision (Law
 * 5.1.2), so Dana holds two cards.
 */
function table({
    revision = FIXED,
    status,
    revealed,
    advisers = [],
    top = [ALCHEMIST, CONQUEST, LONGBOWS],
    favor = false,
    darkestSecret = false,
    visionsDrawn,
    prophesied
}: Table = {}): HydratedOathGameState {
    const banners = {
        ...(favor ? { [Banner.PeoplesFavor]: DANA } : {}),
        ...(darkestSecret ? { [Banner.DarkestSecret]: DANA } : {})
    }
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                ...(status ? { status } : {}),
                ...(revealed ? { revealedVisionId: revealed } : {}),
                advisers: [LAND_WARDEN, ...advisers].map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { rhys: 5 }
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: [WOLVES, TENTS, SONGS], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [DANA]: 1 } },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(favor || darkestSecret ? { banners: testBanners(banners) } : {}),
            ...(revealed && prophesied
                ? { warbandsOnCards: { [revealed]: { rhys: prophesied } } }
                : {})
        }
    )
    if (visionsDrawn !== undefined) s.visionsDrawn = visionsDrawn
    openTurn(s, DANA)
    s.requireVault().worldDeck = top
    return s
}

const SEARCH = buildAction(Search, {
    playerId: DANA,
    drawFrom: SearchSource.WorldDeck,
    revealsInfo: true,
    modifiers: [modifierUse(LAND_WARDEN)]
})

function searched(t: Table = {}): HydratedOathGameState {
    const s = table(t)
    new HydratedSearch(SEARCH).apply(s)
    return s
}

/** Alchemist kept and played to the Great Slum, discarding the Wolves first; `second` played second. */
function alchemistThen(
    second: SearchResolveChoice['secondPlay'],
    more: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId: ALCHEMIST,
        discardOrder: [],
        play: SearchPlay.Site,
        discardFirstCardId: WOLVES,
        ...(second ? { secondPlay: second } : {}),
        ...more
    }
}

const visionSecond = (cardId = CONQUEST) => ({ cardId, play: SearchPlay.RevealedVision })

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice): HydratedSearchResolve {
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: DANA, ...choice })
    )
    action.apply(s)
    return action
}

describe("Land Warden's second card to the Revealed Vision space (from revision 32)", () => {
    it('the scene: the draw stopped at the Vision, so Dana holds Alchemist and the Vision of Conquest', () => {
        const s = searched()
        expect(s.getPlayerState(DANA).knownHand()).toEqual([ALCHEMIST, CONQUEST])
        expect(s.denizensAt('c1')).toEqual([WOLVES, TENTS, SONGS])
    })

    it("Alchemist to the full Great Slum, the Wolves first, and the Vision second as Dana's Vision: accepted, on Dana's own view too", () => {
        const s = searched()
        const choice = alchemistThen(visionSecond())
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
    })

    it("applied: the Vision is on Dana's Revealed Vision space, Alchemist at the site, the Wolves in the pile", () => {
        const s = searched()
        const player = s.getPlayerState(DANA)
        // Land Warden's cost, 1 favor, was placed on it at the Search (Law 7.1.2).
        expect(player.favor).toBe(2)
        const action = resolve(s, alchemistThen(visionSecond()))
        expect(player.revealedVisionId).toBe(CONQUEST)
        expect(player.knownHand()).toEqual([])
        expect(player.knownAdviserIds()).toEqual([LAND_WARDEN])
        expect(s.denizensAt('c1')).toEqual([TENTS, SONGS, ALCHEMIST])
        // R-5.1.4.I — Alchemist's favor; the Vision, not played to a site, gains none.
        expect(player.favor).toBe(3)
        const meta = action.metadata
        assertExists(meta, 'The resolve records what it did')
        expect(meta.playedCardId).toBe(ALCHEMIST)
        // R-9.4 — a revealed Vision is shown.
        expect(meta.secondPlayedCardId).toBe(CONQUEST)
        expect(meta.discardedCardIds).toEqual([WOLVES])
        expect(s.requireVault().discardPiles[meta.discardPileRegion]).toEqual([WOLVES])
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('a Vision already revealed is discarded (R-5.1.4.III) to the pile the Search discards to', () => {
        const s = searched({ revealed: FAITH })
        const choice = alchemistThen(visionSecond())
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        const action = resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        const meta = action.metadata
        assertExists(meta, 'The resolve records what it did')
        expect(meta.discardPileRegion).toBe(Region.Provinces)
        expect(meta.discardedCardIds).toEqual([WOLVES, FAITH])
        expect(meta.discardedCount).toBe(2)
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([FAITH, WOLVES])
    })

    it("False Prophet: Rhys's warband on the Vision replaced dies, and Rhys is asked to play or discard it, as for a kept Vision", () => {
        const s = searched({ revealed: FAITH, prophesied: 1 })
        const action = resolve(s, alchemistThen(visionSecond()))
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        // R-10.13 — the killed warband goes back to its player's bank; the Vision waits for its answer, not the pile.
        expect(s.warbandsOnCard(FAITH)).toEqual({ rhys: 0 })
        expect(s.getPlayerState('rhys').warbandsInPersonalBank['rhys']).toBe(6)
        expect(action.metadata?.discardedCardIds).toEqual([WOLVES])
        expect(s.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.PlayOrDiscardVision,
                cardId: FALSE_PROPHET_ID,
                askedPlayerId: 'rhys',
                visionCardId: FAITH
            }
        ])
    })

    it('control: the Vision second as a facedown adviser is still accepted', () => {
        const s = searched()
        expect(
            checkOf(s, alchemistThen({ cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }))
        ).toBeUndefined()
    })

    it('with no card to a site it is refused: Alchemist as an adviser, the Vision as their Vision', () => {
        const s = searched()
        const choice: SearchResolveChoice = {
            keptCardId: ALCHEMIST,
            discardOrder: [],
            play: SearchPlay.Adviser,
            faceUp: true,
            secondPlay: visionSecond()
        }
        expect(checkOf(s, choice)).toBe(NO_SITE)
        expect(checkOf(ownView(s), choice)).toBe(NO_SITE)
    })

    for (const status of [PlayerStatus.Citizen, PlayerStatus.Chancellor]) {
        it(`a ${status} is refused: only an Exile plays a Vision faceup (R-5.1.4.III)`, () => {
            const s = searched({ status })
            const refused = `second card: a ${status} cannot play a Vision faceup`
            expect(checkOf(s, alchemistThen(visionSecond()))).toBe(refused)
            expect(checkOf(ownView(s), alchemistThen(visionSecond()))).toBe(refused)
        })
    }

    it('the Conspiracy as the second card is refused on the Revealed Vision space (R-5.1.4.IV)', () => {
        const s = searched({ top: [ALCHEMIST, CONSPIRACY_ID, LONGBOWS] })
        expect(s.getPlayerState(DANA).knownHand()).toEqual([ALCHEMIST, CONSPIRACY_ID])
        expect(checkOf(s, alchemistThen(visionSecond(CONSPIRACY_ID)))).toBe(
            'second card: the Conspiracy is not played to the Revealed Vision space (R-5.1.4.IV)'
        )
    })

    it('a denizen as the second card is refused there: it is not a Vision', () => {
        const s = searched({ top: [ALCHEMIST, LONGBOWS, FILLER] })
        expect(
            checkOf(
                s,
                alchemistThen(
                    { cardId: LONGBOWS, play: SearchPlay.RevealedVision },
                    { discardOrder: [FILLER] }
                )
            )
        ).toBe(`second card: ${LONGBOWS} is not a Vision`)
    })

    it('at the adviser limit the Vision needs no adviser discarded: the Revealed Vision space is not an adviser', () => {
        const s = searched({ advisers: [WOLVES, RANGERS] })
        expect(s.getPlayerState(DANA).knownAdviserIds()).toHaveLength(3)
        const choice = alchemistThen(visionSecond(), { discardFirstCardId: TENTS })
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).knownAdviserIds()).toEqual([LAND_WARDEN, WOLVES, RANGERS])
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
    })

    it("the kept card's two cards discarded first (the Great Slum and the People's Favor), then the Vision as Dana's Vision", () => {
        const s = searched({ favor: true })
        const choice = alchemistThen(visionSecond(), {
            discardFirstCardId: undefined,
            discardFirstCardIds: [WOLVES, TENTS]
        })
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.denizensAt('c1')).toEqual([SONGS, ALCHEMIST])
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
    })

    it('control: with no card discarded first the full Great Slum still refuses Alchemist; the Vision takes no space there', () => {
        const s = searched()
        expect(
            checkOf(s, alchemistThen(visionSecond(), { discardFirstCardId: undefined }))
        ).toContain('capacity')
    })

    it('the Vision revealed second is the one judged at the Wake (R-3.2): Faith with the Darkest Secret wins', () => {
        const s = searched({
            top: [ALCHEMIST, FAITH, LONGBOWS],
            darkestSecret: true,
            visionsDrawn: 2
        })
        expect(s.visionsDrawn).toBe(3)
        expect(wakePhaseWin(s, DANA)).toBeUndefined()
        resolve(s, alchemistThen(visionSecond(FAITH)))
        expect(wakePhaseWin(s, DANA)).toMatchObject({ winnerPlayerId: DANA, rule: 'R-3.2' })
    })
})

describe('through the engine: what the other seats are told, and Undo', () => {
    it('the record shows the Vision to every seat, and Undo is not offered after it (R-X.3)', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table().dehydrate()
        state = engine.runNext(SEARCH, state, game).updatedState
        const resolveAction: GameAction = buildAction(SearchResolve, {
            playerId: DANA,
            ...alchemistThen(visionSecond())
        })
        const result = engine.runNext(resolveAction, state, game)
        const recorded = result.processedActions.find(
            (a) => a.type === resolveAction.type && a.playerId === DANA
        )
        assertExists(recorded, 'The engine records the resolve')
        const after = new HydratedOathGameState(result.updatedState)
        expect(after.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        expect(recorded).toHaveProperty('metadata.secondPlayedCardId', CONQUEST)
        expect(recorded.revealsInfo).toBe(true)
        const theirs = OathVisibility.actions.project(recorded, rhys)
        expect(theirs).toHaveProperty('metadata.secondPlayedCardId', CONQUEST)
        expect(theirs).toHaveProperty('metadata.playedCardId', ALCHEMIST)
        expect(served(after, rhys).players.find((p) => p.playerId === DANA)).toHaveProperty(
            'revealedVisionId',
            CONQUEST
        )
        expect(latestPlayerUndoTarget(result.processedActions, DANA)).toBeUndefined()
    })
})

describe('before revision 32 a game keeps the plays it was recorded with', () => {
    it("the Vision second to Dana's Revealed Vision space is refused", () => {
        const s = searched({ revision: BEFORE })
        expect(checkOf(s, alchemistThen(visionSecond()))).toBe(NOT_THIS_PLAY)
        expect(checkOf(ownView(s), alchemistThen(visionSecond()))).toBe(NOT_THIS_PLAY)
    })

    it('the Vision second as a facedown adviser is accepted, as it was', () => {
        const s = searched({ revision: BEFORE })
        const choice = alchemistThen({ cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false })
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).knownAdviser(CONQUEST)?.faceUp).toBe(false)
        expect(s.getPlayerState(DANA).revealedVisionId).toBeUndefined()
    })
})
