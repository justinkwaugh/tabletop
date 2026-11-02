import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, yes } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { TENTS } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import { whenPlayedStatusAfter } from '../util/cardPlay.js'
import type { PowerChoice } from '../model/powerChoice.js'
import '../powers/index.js'

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." The kept
// card is played first and its power resolves, then the second card is played (R-7.3.3-H3), so a Vision played
// second to the Revealed Vision space is judged on the state the kept card's play leaves: the status its When Played
// power gives (Law 5.1.4.III: "The Chancellor and Citizens cannot play Vision cards faceup except for the
// Conspiracy"), and the cards in play once the kept card is at its site and the cards it discards first are gone
// (Secret Police: "Enemies cannot play Visions faceup while their pawn is at any site ruled by Secret Police's
// ruler").

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const BEWITCH = 'denizen.arcane.bewitch'
const LONG_LOST_HEIR = 'denizen.beast.long-lost-heir'
const ROYAL_AMBITIONS = 'denizen.discord.royal-ambitions'
const ANCIENT_PACT = 'denizen.nomad.ancient-pact'
const SECRET_POLICE = 'denizen.order.secret-police'
const CONQUEST = 'vision.conquest'

const DANA = 'dana'
const RHYS = 'rhys'
const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }

const A_CITIZEN = `second card: a ${PlayerStatus.Citizen} cannot play a Vision faceup`
const SECRET_POLICE_REFUSES =
    'second card: Secret Police: you cannot play Visions faceup at a site its ruler rules'

interface Table {
    /** The Great Slum's cards (capacity 3). */
    c1?: string[]
    /** The warbands at the Great Slum: its ruler. */
    c1Warbands?: Record<string, number>
    /** The world deck's top three. */
    top?: string[]
}

/**
 * Dana, an Exile, stands at c1, the Great Slum, which holds three cards, so it is full. Dana has Land Warden faceup
 * as an adviser and searches the world deck with it declared; the draw stops at the Vision of Conquest (Law 5.1.2),
 * so Dana holds the card above it and the Vision. Rhys stands at c2.
 */
function searched({
    c1 = [WOLVES, TENTS, SONGS],
    c1Warbands = { [DANA]: 1 },
    top = [ALCHEMIST, CONQUEST, LONGBOWS]
}: Table = {}): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsInPersonalBank: { [DANA]: 5 },
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [RHYS]: 5 }
            })
        ]),
        {
            oathRevision: OathRevision.EngineFixes27,
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
    openTurn(s, DANA)
    s.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(LAND_WARDEN)]
        })
    ).apply(s)
    return s
}

/** `keptCardId` kept and played to the Great Slum, `discardFirstCardId` first; the Vision second as Dana's Vision. */
function keptThenVision(
    keptCardId: string,
    discardFirstCardId: string,
    more: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId,
        discardOrder: [],
        play: SearchPlay.Site,
        discardFirstCardId,
        secondPlay: { cardId: CONQUEST, play: SearchPlay.RevealedVision },
        ...more
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: DANA, ...choice })).apply(s)
}

describe('Land Warden: the kept card makes Dana a Citizen before the second Vision (Law 5.1.4.III)', () => {
    const bewitchDeck = [BEWITCH, CONQUEST, LONGBOWS]

    it('Bewitch kept and answered yes: the Vision second to the Revealed Vision space is refused, on Dana’s own view too', () => {
        const s = searched({ top: bewitchDeck })
        expect(s.getPlayerState(DANA).knownHand()).toEqual([BEWITCH, CONQUEST])
        const choice = keptThenVision(BEWITCH, WOLVES, { choices: [yes] })
        expect(checkOf(s, choice)).toBe(A_CITIZEN)
        expect(checkOf(ownView(s), choice)).toBe(A_CITIZEN)
    })

    it('Bewitch kept and answered yes: resolving it throws, and Dana stays an Exile with no revealed Vision', () => {
        const s = searched({ top: bewitchDeck })
        expect(() => resolve(s, keptThenVision(BEWITCH, WOLVES, { choices: [yes] }))).toThrow(
            A_CITIZEN
        )
        expect(s.getPlayerState(DANA).status).toBe(PlayerStatus.Exile)
        expect(s.getPlayerState(DANA).revealedVisionId).toBeUndefined()
    })

    it('Bewitch kept and not answered yes: Dana stays an Exile, so the Vision is accepted and revealed', () => {
        const s = searched({ top: bewitchDeck })
        const choice = keptThenVision(BEWITCH, WOLVES)
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).status).toBe(PlayerStatus.Exile)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        expect(s.denizensAt('c1')).toEqual([TENTS, SONGS, BEWITCH])
    })

    // Long-Lost Heir, Royal Ambitions and the Ancient Pact go only to the advisers, so they never pair with a Vision
    // played second to the Revealed Vision space; their "become a Citizen" gives the same status as Bewitch's.
    for (const cardId of [BEWITCH, LONG_LOST_HEIR, ROYAL_AMBITIONS, ANCIENT_PACT]) {
        it(`${cardId}: its When Played yes leaves the player a Citizen; with no yes, the status as it is`, () => {
            const s = searched()
            const statusAfter = (choices: PowerChoice[]) =>
                whenPlayedStatusAfter(s, DANA, cardId, SearchPlay.Site, undefined, choices, {
                    leaving: [],
                    arriving: [cardId]
                })
            expect(statusAfter([yes])).toBe(PlayerStatus.Citizen)
            expect(statusAfter([])).toBeUndefined()
        })
    }

    it('control: after Bewitch’s yes the Vision second as a facedown adviser is accepted (a Citizen plays it facedown)', () => {
        const s = searched({ top: bewitchDeck })
        const choice = keptThenVision(BEWITCH, WOLVES, {
            choices: [yes],
            secondPlay: { cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }
        })
        expect(checkOf(s, choice)).toBeUndefined()
    })
})

describe('Land Warden: Secret Police judged on the cards in play the kept card’s play leaves', () => {
    const ruledByRhys = { [RHYS]: 2 }

    it('Secret Police kept and played to the Great Slum, which Rhys rules: the Vision second is refused, on Dana’s own view too', () => {
        const s = searched({ top: [SECRET_POLICE, CONQUEST, LONGBOWS], c1Warbands: ruledByRhys })
        const choice = keptThenVision(SECRET_POLICE, WOLVES)
        expect(checkOf(s, choice)).toBe(SECRET_POLICE_REFUSES)
        expect(checkOf(ownView(s), choice)).toBe(SECRET_POLICE_REFUSES)
        expect(() => resolve(s, choice)).toThrow(SECRET_POLICE_REFUSES)
        expect(s.getPlayerState(DANA).revealedVisionId).toBeUndefined()
    })

    it('control: Secret Police kept to the Great Slum Dana rules: the Vision second is accepted', () => {
        const s = searched({ top: [SECRET_POLICE, CONQUEST, LONGBOWS] })
        const choice = keptThenVision(SECRET_POLICE, WOLVES)
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
    })

    it('Secret Police at the Great Slum Rhys rules, discarded first by the kept play: the Vision second is accepted, on Dana’s own view too', () => {
        const s = searched({ c1: [SECRET_POLICE, TENTS, SONGS], c1Warbands: ruledByRhys })
        const choice = keptThenVision(ALCHEMIST, SECRET_POLICE)
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        expect(s.denizensAt('c1')).toEqual([TENTS, SONGS, ALCHEMIST])
    })

    it('control: Secret Police already at the Great Slum Rhys rules and not discarded: the Vision second is still refused', () => {
        const s = searched({ c1: [SECRET_POLICE, TENTS, SONGS], c1Warbands: ruledByRhys })
        const choice = keptThenVision(ALCHEMIST, TENTS)
        expect(checkOf(s, choice)).toBe(SECRET_POLICE_REFUSES)
        expect(checkOf(ownView(s), choice)).toBe(SECRET_POLICE_REFUSES)
    })
})
