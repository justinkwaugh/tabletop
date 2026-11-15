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
import { playMapChanges, whenPlayedStatusAfter, whenPlayedWarbandsAfter } from '../util/cardPlay.js'
import { rulersOfSite } from '../util/rule.js'
import { reasonPersistentForbidsFaceupVision } from '../util/persistent.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import type { PowerChoice } from '../model/powerChoice.js'
import '../powers/index.js'

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." The kept
// card is played first and its power resolves, then the second card is played (R-7.3.3-H3), so a Vision played
// second to the Revealed Vision space is judged on the state the kept card's play leaves: the status its When Played
// power gives (Law 5.1.4.III: "The Chancellor and Citizens cannot play Vision cards faceup except for the
// Conspiracy"), and the cards in play once the kept card is at its site and the cards it discards first are gone
// (Secret Police: "Enemies cannot play Visions faceup while their pawn is at any site ruled by Secret Police's
// ruler"), with the rulers the warbands that play leaves give.

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
const KEY = 'denizen.discord.key-to-the-city'
const BANDIT_CHIEF = 'denizen.discord.bandit-chief'
const GARRISON = 'denizen.order.garrison'
const RING = 'relic.ring-of-devotion'
const FACEDOWN = { cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }

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
    /** The River's cards. */
    c2?: string[]
    /** The warbands at the other sites. */
    warbands?: Record<string, Record<string, number>>
    /** Where Rhys stands. */
    rhysAt?: string
    /** Dana's relics. */
    danaRelics?: string[]
    /** Dana's warbands in her bank. */
    danaBank?: number
    revision?: OathRevision
}

/**
 * Dana, an Exile, stands at c1, the Great Slum, which holds three cards, so it is full. Dana has Land Warden faceup
 * as an adviser and searches the world deck with it declared; the draw stops at the Vision of Conquest (Law 5.1.2),
 * so Dana holds the card above it and the Vision. Rhys stands at c2, the River.
 */
function searched({
    c1 = [WOLVES, TENTS, SONGS],
    c1Warbands = { [DANA]: 1 },
    top = [ALCHEMIST, CONQUEST, LONGBOWS],
    c2 = [],
    warbands = {},
    rhysAt = 'c2',
    danaRelics = [],
    danaBank = 5,
    revision = OathRevision.EngineFixes27
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
                warbandsInPersonalBank: { [DANA]: danaBank },
                relicIds: danaRelics,
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Blue,
                siteId: rhysAt,
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [RHYS]: 5 }
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2, p1: [], h1: [] },
            warbandsBySite: { c1: c1Warbands, ...warbands },
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

// Key to the City: "When played, if the ruler's pawn is not at this site, kill any warbands at this site, then gain a
// warband and place it here." Bandit Chief: "When played, kill one warband at each site." Garrison: "When played,
// gain one warband per site you rule, and put one warband from your board on each site you rule." The second card is
// played after the kept card's power, so Secret Police's ruler, and who rules Dana's site, are read on the warbands
// that power leaves.
describe('Land Warden: Secret Police judged on the rulers the kept card’s play leaves', () => {
    // Rhys rules the Great Slum with two warbands, their pawn at the River; Secret Police is at the Great Slum.
    const keyToRhysSite: Table = {
        c1: [SECRET_POLICE, TENTS, SONGS],
        c1Warbands: { [RHYS]: 2 },
        top: [KEY, CONQUEST, LONGBOWS]
    }

    it('control: Key to the City kept to the Great Slum Rhys rules, the Vision facedown: after it Dana rules the site and Secret Police allows her a faceup Vision', () => {
        const s = searched(keyToRhysSite)
        resolve(s, keptThenVision(KEY, TENTS, { secondPlay: FACEDOWN }))
        expect(rulersOfSite(s, 'c1')).toEqual([DANA])
        expect(reasonPersistentForbidsFaceupVision(s, DANA, CONQUEST)).toBeUndefined()
    })

    it('Key to the City kept to the Great Slum Rhys rules: the Vision second is accepted, on Dana’s own view too, and revealed', () => {
        const s = searched(keyToRhysSite)
        const choice = keptThenVision(KEY, TENTS)
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        expect(rulersOfSite(s, 'c1')).toEqual([DANA])
    })

    it('Key to the City with Rhys’s pawn at the Great Slum: nothing happens, so the Vision second is still refused, on Dana’s own view too', () => {
        const s = searched({ ...keyToRhysSite, rhysAt: 'c1' })
        const choice = keptThenVision(KEY, TENTS)
        expect(checkOf(s, choice)).toBe(SECRET_POLICE_REFUSES)
        expect(checkOf(ownView(s), choice)).toBe(SECRET_POLICE_REFUSES)
    })

    it('Key to the City with Dana holding the Ring of Devotion: Rhys’s warbands die and none is placed, so the bandits rule the site and the Vision second is refused', () => {
        const s = searched({ ...keyToRhysSite, danaRelics: [RING] })
        const choice = keptThenVision(KEY, TENTS)
        expect(checkOf(s, choice)).toBe(SECRET_POLICE_REFUSES)
        expect(checkOf(ownView(s), choice)).toBe(SECRET_POLICE_REFUSES)
    })

    it('control: Key to the City kept to the Great Slum Dana rules, her pawn there: nothing happens and the Vision second is accepted', () => {
        const s = searched({ ...keyToRhysSite, c1Warbands: { [DANA]: 1 } })
        const choice = keptThenVision(KEY, TENTS)
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
    })

    // Secret Police at the River, where Rhys's pawn stands.
    const secretPoliceAtRiver: Table = {
        c2: [SECRET_POLICE],
        top: [BANDIT_CHIEF, CONQUEST, LONGBOWS]
    }

    it('Bandit Chief kills Rhys’s last warband at the Great Slum, Rhys still ruling the River: the Vision second is accepted, on Dana’s own view too, and revealed', () => {
        const s = searched({
            ...secretPoliceAtRiver,
            c1Warbands: { [RHYS]: 1 },
            warbands: { c2: { [RHYS]: 2 } }
        })
        const choice = keptThenVision(BANDIT_CHIEF, WOLVES)
        expect(checkOf(s, choice)).toBeUndefined()
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
    })

    it('Bandit Chief kills the last warband at the Great Slum and at the River: the bandits rule Secret Police and Dana’s site, so the Vision second is refused, on Dana’s own view too', () => {
        const s = searched({ ...secretPoliceAtRiver, warbands: { c2: { [RHYS]: 1 } } })
        const choice = keptThenVision(BANDIT_CHIEF, WOLVES)
        expect(checkOf(s, choice)).toBe(SECRET_POLICE_REFUSES)
        expect(checkOf(ownView(s), choice)).toBe(SECRET_POLICE_REFUSES)
    })

    it('undo: the Key to the City play with the Vision second undoes to the state before it', () => {
        const s = searched(keyToRhysSite)
        s.machineState = MachineState.Searching
        const start = s.dehydrate()
        const game = {
            ...testGame([DANA, RHYS, 'chancellor']),
            protectedInformation: true as const
        }
        const action = buildAction(SearchResolve, {
            playerId: DANA,
            ...keptThenVision(KEY, TENTS)
        })
        const result = engine.executeCanonicalAction({
            action: { ...action, id: `e-${start.actionCount}`, index: start.actionCount },
            state: start,
            game
        })
        const after = new HydratedOathGameState(result.updatedState as never)
        expect(after.getPlayerState(DANA).revealedVisionId).toBe(CONQUEST)
        let view = result.updatedState
        for (const a of result.processedActions.toReversed())
            view = engine.undoProcessedAction({ state: view, action: a })
        expect(view).toEqual(start)
    })

    it('revision 31: Key to the City kept, the Vision second to the Revealed Vision space: refused for the route, as before', () => {
        const s = searched({ ...keyToRhysSite, revision: OathRevision.EngineFixes26 })
        expect(checkOf(s, keptThenVision(KEY, TENTS))).toBe(
            'the second card is played to your site or as an adviser'
        )
    })
})

describe('Land Warden: the warbands planned for the kept card’s When Played power are the ones it leaves', () => {
    const scenes: { name: string; cardId: string; first: string; table: Table }[] = [
        {
            name: 'Key to the City at a site Rhys rules',
            cardId: KEY,
            first: TENTS,
            table: { c1Warbands: { [RHYS]: 2 } }
        },
        {
            name: 'Key to the City with the ruler’s pawn there',
            cardId: KEY,
            first: TENTS,
            table: { c1Warbands: { [RHYS]: 2 }, rhysAt: 'c1' }
        },
        {
            name: 'Key to the City with the Ring of Devotion',
            cardId: KEY,
            first: TENTS,
            table: { c1Warbands: { [RHYS]: 2 }, danaRelics: [RING] }
        },
        {
            name: 'Key to the City with Dana’s bank empty',
            cardId: KEY,
            first: TENTS,
            table: { c1Warbands: { [RHYS]: 2 }, danaBank: 0 }
        },
        {
            name: 'Bandit Chief',
            cardId: BANDIT_CHIEF,
            first: WOLVES,
            table: { c1Warbands: { [RHYS]: 1, [DANA]: 2 }, warbands: { c2: { [RHYS]: 2 } } }
        },
        {
            name: 'Garrison',
            cardId: GARRISON,
            first: WOLVES,
            table: { warbands: { p1: { [DANA]: 2 }, c2: { [RHYS]: 1 } } }
        },
        {
            name: 'Garrison with one warband in Dana’s bank',
            cardId: GARRISON,
            first: WOLVES,
            table: { warbands: { p1: { [DANA]: 2 } }, danaBank: 1 }
        }
    ]
    const present = (bySite: Record<string, Record<string, number>>) =>
        Object.fromEntries(
            Object.entries(bySite)
                .map(([siteId, counts]) => [
                    siteId,
                    Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0))
                ])
                .filter(([, counts]) => Object.keys(counts).length > 0)
        )

    for (const { name, cardId, first, table } of scenes) {
        it(`${name}: planned before the play, the same as after it`, () => {
            const s = searched({ ...table, top: [cardId, CONQUEST, LONGBOWS] })
            const changes = playMapChanges(s, DANA, cardId, SearchPlay.Site, {
                discardFirstCardId: first
            })
            const planned = whenPlayedWarbandsAfter(
                s,
                DANA,
                cardId,
                SearchPlay.Site,
                undefined,
                [],
                changes
            )
            const before = structuredClone(s.warbandsBySite)
            resolve(s, {
                keptCardId: cardId,
                discardOrder: [CONQUEST],
                play: SearchPlay.Site,
                discardFirstCardId: first
            })
            expect(planned).toBeDefined()
            expect(present({ ...before, ...planned })).toEqual(present(s.warbandsBySite))
        })
    }
})
