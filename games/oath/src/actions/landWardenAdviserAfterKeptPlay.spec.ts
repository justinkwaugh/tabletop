import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice,
    type SearchSecondPlay
} from './searchResolve.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse, yes } from '../testing/choices.js'
import { served } from '../testing/projection.js'
import { TENTS } from '../testing/cards.js'
import { FOREST_TEMPLE, placeEdifice } from '../testing/edifices.js'
import { OathRevision } from '../util/revision.js'
import { rulersOfSite } from '../util/rule.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import '../powers/index.js'

// Land Warden: "You may play two cards you draw (instead of one) if you play at least one card to a site." The kept
// card is played first and its power resolves, then the second card is played (R-7.3.3-H3), so from revision 33 a
// second card played as an adviser, or to a site, is judged on the state the kept card's play leaves: the cards in
// play once the kept card is at its site and the cards it discards first are gone, the rulers the warbands that play
// leaves give, and the status its When Played power gives. Gossip: "Enemies of Gossip's ruler cannot play cards as
// facedown advisers." Ruined Temple: "Enemies of Ruined Temple's ruler cannot play [beast] cards faceup."

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const SONGS = 'denizen.hearth.tavern-songs'
const ALCHEMIST = 'denizen.arcane.alchemist'
const LONGBOWS = 'denizen.order.longbows'
const BEWITCH = 'denizen.arcane.bewitch'
const GOSSIP = 'denizen.discord.gossip'
const SECRET_POLICE = 'denizen.order.secret-police'
const FORCED_LABOR = 'denizen.order.forced-labor'
const KEY = 'denizen.discord.key-to-the-city'
const CONQUEST = 'vision.conquest'

const FACEDOWN: SearchSecondPlay = { cardId: CONQUEST, play: SearchPlay.Adviser, faceUp: false }
const RANGERS_FACEUP: SearchSecondPlay = { cardId: RANGERS, play: SearchPlay.Adviser, faceUp: true }
const RANGERS_TO_SITE: SearchSecondPlay = { cardId: RANGERS, play: SearchPlay.Site }

const DANA = 'dana'
const RHYS = 'rhys'
const dana: Visibility.Perspective = { kind: 'player', playerId: DANA }

const GOSSIP_REFUSES =
    'second card: Gossip: enemies of its ruler cannot play cards as facedown advisers'
const TEMPLE_REFUSES =
    'second card: Ruined Temple: enemies of its ruler cannot play beast cards faceup'

const NOW = OathRevision.EngineFixes28
const BEFORE = OathRevision.EngineFixes27

interface Table {
    /** The Great Slum's cards (capacity 3). */
    c1?: string[]
    /** The warbands at the Great Slum: its ruler. */
    c1Warbands?: Record<string, number>
    /** The world deck's top three. */
    top?: string[]
    /** The River's cards. */
    c2?: string[]
    /** The warbands at the River. */
    c2Warbands?: Record<string, number>
    /** Where Rhys stands. */
    rhysAt?: string
    /** Ruined Temple at the Great Slum, before its other cards. */
    ruinedTemple?: boolean
    /** The tolls Dana pays to search (Forced Labor). */
    tolls?: string[]
    revision?: OathRevision
}

/**
 * Dana, an Exile, stands at c1, the Great Slum, which holds three cards, so it is full. Dana has Land Warden faceup
 * as an adviser and searches the world deck with it declared; the draw stops at the Vision of Conquest (Law 5.1.2),
 * so Dana holds the card above it and the Vision. Rhys, an Exile, stands at c2, the River, which Rhys rules.
 */
function searched({
    c1 = [WOLVES, TENTS, SONGS],
    c1Warbands = { [DANA]: 1 },
    top = [ALCHEMIST, CONQUEST, LONGBOWS],
    c2 = [],
    c2Warbands = { [RHYS]: 2 },
    rhysAt = 'c2',
    ruinedTemple = false,
    tolls,
    revision = NOW
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
                siteId: rhysAt,
                favor: 2,
                secrets: 2,
                warbandsInPersonalBank: { [RHYS]: 5 }
            })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1, c2, p1: [], h1: [] },
            warbandsBySite: { c1: c1Warbands, c2: c2Warbands },
            siteCards: {
                c1: 'site.great-slums',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    if (ruinedTemple) placeEdifice(s, 'c1', FOREST_TEMPLE, { ruined: true })
    openTurn(s, DANA)
    s.requireVault().worldDeck = [...top]
    new HydratedSearch(
        buildAction(Search, {
            playerId: DANA,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(LAND_WARDEN)],
            ...(tolls ? { tolls } : {})
        })
    ).apply(s)
    return s
}

/** `keptCardId` kept and played to the Great Slum, `discardFirstCardId` first when given; `second` after it. */
function keptThen(
    keptCardId: string,
    discardFirstCardId: string | undefined,
    second: SearchSecondPlay = FACEDOWN,
    more: Partial<SearchResolveChoice> = {}
): SearchResolveChoice {
    return {
        keptCardId,
        discardOrder: [],
        play: SearchPlay.Site,
        ...(discardFirstCardId !== undefined ? { discardFirstCardId } : {}),
        secondPlay: second,
        ...more
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, DANA, choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

/** The check on the table and on Dana's own view: the same answer. */
function checkBoth(s: HydratedOathGameState, choice: SearchResolveChoice) {
    const reason = checkOf(s, choice)
    expect(checkOf(ownView(s), choice)).toBe(reason)
    return reason
}

function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    new HydratedSearchResolve(buildAction(SearchResolve, { playerId: DANA, ...choice })).apply(s)
}

const ruledByRhys = { [RHYS]: 2 }

describe('Land Warden: Gossip judged on the cards in play the kept card’s play leaves', () => {
    it('control: Gossip stays at the Great Slum, which Rhys rules: the second card facedown is refused, on Dana’s own view too', () => {
        const s = searched({ c1: [GOSSIP, TENTS, SONGS], c1Warbands: ruledByRhys })
        expect(checkBoth(s, keptThen(ALCHEMIST, TENTS))).toBe(GOSSIP_REFUSES)
        expect(() => resolve(s, keptThen(ALCHEMIST, TENTS))).toThrow(GOSSIP_REFUSES)
    })

    it('Gossip discarded first by the kept play: the second card facedown is accepted, on Dana’s own view too, and played', () => {
        const s = searched({ c1: [GOSSIP, TENTS, SONGS], c1Warbands: ruledByRhys })
        const choice = keptThen(ALCHEMIST, GOSSIP)
        expect(checkBoth(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.denizensAt('c1')).toEqual([TENTS, SONGS, ALCHEMIST])
        expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(CONQUEST)
    })

    it('revision 32: Gossip discarded first by the kept play: the second card facedown is still refused, as recorded', () => {
        const s = searched({
            c1: [GOSSIP, TENTS, SONGS],
            c1Warbands: ruledByRhys,
            revision: BEFORE
        })
        expect(checkBoth(s, keptThen(ALCHEMIST, GOSSIP))).toBe(GOSSIP_REFUSES)
    })

    it('Gossip at the River, which the kept play leaves untouched: the second card facedown is refused, as before', () => {
        const s = searched({ c2: [GOSSIP] })
        expect(checkBoth(s, keptThen(ALCHEMIST, WOLVES))).toBe(GOSSIP_REFUSES)
    })

    it('control: no Gossip in play: the second card facedown is accepted', () => {
        const s = searched()
        expect(checkBoth(s, keptThen(ALCHEMIST, WOLVES))).toBeUndefined()
    })

    it('Gossip is the kept card, played to the Great Slum Rhys rules: the second card facedown is refused, on Dana’s own view too', () => {
        const s = searched({ top: [GOSSIP, CONQUEST, LONGBOWS], c1Warbands: ruledByRhys })
        const choice = keptThen(GOSSIP, WOLVES)
        expect(checkBoth(s, choice)).toBe(GOSSIP_REFUSES)
        expect(() => resolve(s, choice)).toThrow(GOSSIP_REFUSES)
        expect(s.getPlayerState(DANA).knownAdviserIds()).not.toContain(CONQUEST)
    })

    it('revision 32: Gossip is the kept card, played to the Great Slum Rhys rules: the second card facedown is accepted, as recorded', () => {
        const s = searched({
            top: [GOSSIP, CONQUEST, LONGBOWS],
            c1Warbands: ruledByRhys,
            revision: BEFORE
        })
        expect(checkBoth(s, keptThen(GOSSIP, WOLVES))).toBeUndefined()
    })

    it('control: Gossip kept to the Great Slum Dana rules: the second card facedown is accepted', () => {
        const s = searched({ top: [GOSSIP, CONQUEST, LONGBOWS] })
        expect(checkBoth(s, keptThen(GOSSIP, WOLVES))).toBeUndefined()
    })

    it('undo: the play with Gossip discarded first and the second card facedown undoes to the state before it', () => {
        const s = searched({ c1: [GOSSIP, TENTS, SONGS], c1Warbands: ruledByRhys })
        s.machineState = MachineState.Searching
        const start = s.dehydrate()
        const game = {
            ...testGame([DANA, RHYS, 'chancellor']),
            protectedInformation: true as const
        }
        const action = buildAction(SearchResolve, {
            playerId: DANA,
            ...keptThen(ALCHEMIST, GOSSIP)
        })
        const result = engine.executeCanonicalAction({
            action: { ...action, id: `e-${start.actionCount}`, index: start.actionCount },
            state: start,
            game
        })
        const after = new HydratedOathGameState(result.updatedState as never)
        expect(after.getPlayerState(DANA).knownAdviserIds()).toContain(CONQUEST)
        let view = result.updatedState
        for (const a of result.processedActions.toReversed())
            view = engine.undoProcessedAction({ state: view, action: a })
        expect(view).toEqual(start)
    })
})

// Key to the City: "When played, if the ruler's pawn is not at this site, kill any warbands at this site, then gain a
// warband and place it here." The second card is played after it, so Gossip's ruler is read on the warbands it leaves.
describe('Land Warden: Gossip judged on the rulers the kept card’s play leaves', () => {
    const keyToRhysSite: Table = {
        c1: [GOSSIP, TENTS, SONGS],
        c1Warbands: ruledByRhys,
        top: [KEY, CONQUEST, LONGBOWS]
    }

    it('Key to the City kept to the Great Slum Rhys rules, with Gossip there: the second card facedown is accepted, on Dana’s own view too, and played', () => {
        const s = searched(keyToRhysSite)
        const choice = keptThen(KEY, TENTS)
        expect(checkBoth(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(rulersOfSite(s, 'c1')).toEqual([DANA])
        expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(CONQUEST)
    })

    it('Key to the City with Rhys’s pawn at the Great Slum: nothing happens, so the second card facedown is still refused', () => {
        const s = searched({ ...keyToRhysSite, rhysAt: 'c1' })
        expect(checkBoth(s, keptThen(KEY, TENTS))).toBe(GOSSIP_REFUSES)
    })

    it('revision 32: Key to the City kept to the Great Slum Rhys rules: the second card facedown is refused, as recorded', () => {
        const s = searched({ ...keyToRhysSite, revision: BEFORE })
        expect(checkBoth(s, keptThen(KEY, TENTS))).toBe(GOSSIP_REFUSES)
    })
})

// Bewitch: "When played, if you're an Exile and have more secrets (even on cards) than the Chancellor, you may become
// a Citizen". Gossip at the Great Slum is the Chancellor's; a Citizen is no enemy of the Chancellor (Law 10.12).
describe('Land Warden: Gossip judged on the status the kept card’s play gives', () => {
    const bewitchAtImperialGossip: Table = {
        c1: [GOSSIP, TENTS, SONGS],
        c1Warbands: { [IMPERIAL_WARBANDS]: 2 },
        top: [BEWITCH, CONQUEST, LONGBOWS]
    }

    it('Bewitch kept and answered yes: Dana is a Citizen, so the second card facedown is accepted, on Dana’s own view too, and played', () => {
        const s = searched(bewitchAtImperialGossip)
        const choice = keptThen(BEWITCH, TENTS, FACEDOWN, { choices: [yes] })
        expect(checkBoth(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.getPlayerState(DANA).status).toBe(PlayerStatus.Citizen)
        expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(CONQUEST)
    })

    it('control: Bewitch kept and not answered yes: Dana stays an Exile, so the second card facedown is refused', () => {
        const s = searched(bewitchAtImperialGossip)
        expect(checkBoth(s, keptThen(BEWITCH, TENTS))).toBe(GOSSIP_REFUSES)
    })

    it('revision 32: Bewitch kept and answered yes: the second card facedown is refused, as recorded', () => {
        const s = searched({ ...bewitchAtImperialGossip, revision: BEFORE })
        const choice = keptThen(BEWITCH, TENTS, FACEDOWN, { choices: [yes] })
        expect(checkBoth(s, choice)).toBe(GOSSIP_REFUSES)
    })
})

// Neither card restricts an adviser play: Secret Police forbids faceup Visions, Forced Labor a Search's draw. The
// second card as an adviser is judged as before.
describe('Land Warden: kept cards that do not restrict an adviser play', () => {
    for (const cardId of [SECRET_POLICE, FORCED_LABOR]) {
        it(`${cardId} kept to the Great Slum Rhys rules: the second card facedown is accepted`, () => {
            const s = searched({ top: [cardId, CONQUEST, LONGBOWS], c1Warbands: ruledByRhys })
            expect(checkBoth(s, keptThen(cardId, WOLVES))).toBeUndefined()
        })

        it(`${cardId} at the Great Slum Rhys rules, discarded first: the second card facedown is accepted`, () => {
            const s = searched({
                c1: [cardId, TENTS, SONGS],
                c1Warbands: ruledByRhys,
                ...(cardId === FORCED_LABOR ? { tolls: [FORCED_LABOR] } : {})
            })
            expect(checkBoth(s, keptThen(ALCHEMIST, cardId))).toBeUndefined()
        })
    }
})

// Ruined Temple, at the Great Slum Rhys rules, binds a beast card played faceup to a site or as an adviser.
describe('Land Warden: Ruined Temple judged on the rulers the kept card’s play leaves', () => {
    const keyToTempleSite: Table = {
        ruinedTemple: true,
        c1: [],
        c1Warbands: ruledByRhys,
        top: [KEY, RANGERS, CONQUEST]
    }
    const keyThen = (second: SearchSecondPlay) =>
        keptThen(KEY, undefined, second, { discardOrder: [CONQUEST] })

    for (const [name, second] of [
        ['as a faceup adviser', RANGERS_FACEUP],
        ['to the site', RANGERS_TO_SITE]
    ] as const) {
        it(`control: Alchemist kept: Rangers second ${name} is refused`, () => {
            const s = searched({ ...keyToTempleSite, top: [ALCHEMIST, RANGERS, CONQUEST] })
            const choice = keptThen(ALCHEMIST, undefined, second, { discardOrder: [CONQUEST] })
            expect(checkBoth(s, choice)).toBe(TEMPLE_REFUSES)
        })

        it(`Key to the City kept: Dana rules the Temple after it, so Rangers second ${name} is accepted, on Dana’s own view too, and played`, () => {
            const s = searched(keyToTempleSite)
            expect(checkBoth(s, keyThen(second))).toBeUndefined()
            resolve(s, keyThen(second))
            expect(rulersOfSite(s, 'c1')).toEqual([DANA])
            if (second.play === SearchPlay.Site) expect(s.denizensAt('c1')).toContain(RANGERS)
            else expect(s.getPlayerState(DANA).knownAdviserIds()).toContain(RANGERS)
        })

        it(`Key to the City with Rhys’s pawn there: Rangers second ${name} is still refused`, () => {
            const s = searched({ ...keyToTempleSite, rhysAt: 'c1' })
            expect(checkBoth(s, keyThen(second))).toBe(TEMPLE_REFUSES)
        })

        it(`revision 32: Key to the City kept: Rangers second ${name} is refused, as recorded`, () => {
            const s = searched({ ...keyToTempleSite, revision: BEFORE })
            expect(checkBoth(s, keyThen(second))).toBe(TEMPLE_REFUSES)
        })
    }
})
