import { describe, expect, it } from 'vitest'
import { Color, type GameAction, type Visibility } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    type SearchResolveChoice
} from './searchResolve.js'
import { EndActPhase } from './endActPhase.js'
import { Banner } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { FILLER, INN } from '../testing/cards.js'
import { siteHolding } from '../util/access.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import type { ModifierUse } from '../util/modifiers.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

// Law 7.4.3: "A modifier cannot be discarded during the major action it is modifying." Law 9.2: a "cannot" rule
// overrides a "must" rule, so the mass discards of a card played during a Search (Salt the Earth, Riots, Dazzle,
// Threatening Roar) leave out a modifier that Search uses. Capacity only refuses plays (Law 2.8.1, 5.1.4): a
// salted site that keeps a modifier stays over its capacity of 1, and nothing more can be played there.

const SALT = 'denizen.discord.salt-the-earth'
const RIOTS = 'denizen.discord.riots'
const DAZZLE = 'denizen.arcane.dazzle'
const ROAR = 'denizen.beast.threatening-roar'
const WELCOMING = 'denizen.hearth.welcoming-party'
const WILD_CRY = 'denizen.beast.wild-cry'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const HUNTING_PARTY = 'denizen.order.hunting-party'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const KNIGHTS = 'denizen.order.knights-errant'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'

const FIXED = OathRevision.EngineFixes26
const BEFORE = OathRevision.EngineFixes25

const dana: Visibility.Perspective = { kind: 'player', playerId: 'dana' }

interface Table {
    top: string[]
    modifiers: ModifierUse[]
    /** Dana's site c1, the Plains (capacity 3). */
    atSite?: string[]
    /** c2, the River, also in the Cradle. */
    atC2?: string[]
    advisers?: string[]
    mob?: boolean
}

/** Dana at c1 with one warband, before the Search. */
function table(revision: OathRevision, t: Table): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 6,
                secrets: 2,
                supply: 7,
                advisers: (t.advisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1', favor: 2, secrets: 2 })
        ]),
        {
            oathRevision: revision,
            denizensBySite: { c1: t.atSite ?? [], c2: t.atC2 ?? [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 } },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            }
        }
    )
    if (t.mob) s.banners[Banner.PeoplesFavor].mobSide = true
    openTurn(s, 'dana')
    s.requireVault().worldDeck = [...t.top]
    return s
}

function searchOf(t: Table): Search {
    return buildAction(Search, {
        playerId: 'dana',
        drawFrom: SearchSource.WorldDeck,
        revealsInfo: true,
        modifiers: t.modifiers
    })
}

/** Dana has searched the world deck with `modifiers` declared. */
function searched(revision: OathRevision, t: Table): HydratedOathGameState {
    const s = table(revision, t)
    new HydratedSearch(searchOf(t)).apply(s)
    return s
}

function others(s: HydratedOathGameState, ...kept: string[]): string[] {
    return s
        .getPlayerState('dana')
        .knownHand()
        .filter((id) => !kept.includes(id))
}

/** `kept` played `play` (faceup when an adviser), every other drawn card but `second` discarded. */
function keeping(
    s: HydratedOathGameState,
    kept: string,
    play: SearchPlay,
    second?: { cardId: string; play: SearchPlay }
): SearchResolveChoice {
    return {
        keptCardId: kept,
        discardOrder: others(s, kept, ...(second ? [second.cardId] : [])),
        play,
        faceUp: play === SearchPlay.Adviser ? true : undefined,
        ...(second
            ? {
                  secondPlay: {
                      ...second,
                      faceUp: second.play === SearchPlay.Adviser ? true : undefined
                  }
              }
            : {})
    }
}

const checkOf = (s: HydratedOathGameState, choice: SearchResolveChoice) =>
    HydratedSearchResolve.reasonCannotResolve(s, 'dana', choice)

/** Dana's own view of the table, as the server projects it to them. */
const ownView = (s: HydratedOathGameState) =>
    OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

/** Applies the resolve; returns the action (for its record) and what Dana gained. */
function resolve(s: HydratedOathGameState, choice: SearchResolveChoice) {
    const before = {
        favor: s.getPlayerState('dana').favor,
        supply: s.getPlayerState('dana').supply
    }
    const action = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: 'dana', ...choice })
    )
    action.apply(s)
    return {
        action,
        favor: s.getPlayerState('dana').favor - before.favor,
        supply: s.getPlayerState('dana').supply - before.supply
    }
}

const sorted = (ids: readonly string[]) => [...ids].sort()

/** The cards on the discard piles (the Search's own drawn cards among them). */
const piled = (s: HydratedOathGameState) => Object.values(s.requireVault().discardPiles).flat()

const WELCOMING_AT_SITE: Table = {
    top: [SALT, FILLER, FILLER],
    modifiers: [modifierUse(WELCOMING)],
    atSite: [WELCOMING, WOLVES]
}

describe('Salt the Earth to a site holding a Search modifier in use (Law 7.4.3, 9.2)', () => {
    it('Welcoming Party in use stays: Salt discards the Wolves only, and Welcoming Party pays its favor once', () => {
        const s = searched(FIXED, WELCOMING_AT_SITE)
        const { action, favor } = resolve(s, keeping(s, SALT, SearchPlay.Site))
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([SALT, WELCOMING]))
        // The Plains' play pays 1, Welcoming Party 1.
        expect(favor).toBe(2)
        expect(piled(s)).toContain(WOLVES)
        expect(piled(s)).not.toContain(WELCOMING)
        expect(action.metadata?.whenPlayed).toContain('discarded 1 denizens')
        expect(s.searchModifiersInUse).toBeUndefined()
    })

    it('control: Welcoming Party not declared is discarded with the Wolves', () => {
        const s = searched(FIXED, { ...WELCOMING_AT_SITE, modifiers: [] })
        const { action, favor } = resolve(s, keeping(s, SALT, SearchPlay.Site))
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(favor).toBe(1)
        expect(action.metadata?.whenPlayed).toContain('discarded 2 denizens')
    })

    it('before revision 31 a game keeps its discard: Welcoming Party in use is discarded and still pays', () => {
        const s = searched(BEFORE, WELCOMING_AT_SITE)
        const { favor } = resolve(s, keeping(s, SALT, SearchPlay.Site))
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(favor).toBe(2)
    })

    it("on Dana's own view: Salt to the site is accepted, with neither the state copied nor changed", () => {
        const s = searched(FIXED, WELCOMING_AT_SITE)
        const server = JSON.stringify(s.dehydrate())
        const own = ownView(s)
        expect(own.searchModifiersInUse).toEqual([WELCOMING])
        expect(checkOf(own, keeping(own, SALT, SearchPlay.Site))).toBeUndefined()
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('Land Warden in use at the site stays: Salt kept to the site, Longbows second as an adviser', () => {
        const s = searched(FIXED, {
            top: [SALT, LONGBOWS, FILLER],
            modifiers: [modifierUse(LAND_WARDEN)],
            atSite: [LAND_WARDEN, WOLVES]
        })
        const choice = keeping(s, SALT, SearchPlay.Site, {
            cardId: LONGBOWS,
            play: SearchPlay.Adviser
        })
        expect(checkOf(ownView(s), choice)).toBeUndefined()
        resolve(s, choice)
        expect(sorted(s.denizensAt('c1'))).toEqual(sorted([SALT, LAND_WARDEN]))
        expect(s.getPlayerState('dana').faceupAdviserIds()).toContain(LONGBOWS)
        expect(piled(s)).not.toContain(LAND_WARDEN)
    })

    it('before revision 31, Land Warden in use at the site is discarded by Salt, and Longbows is still played', () => {
        const s = searched(BEFORE, {
            top: [SALT, LONGBOWS, FILLER],
            modifiers: [modifierUse(LAND_WARDEN)],
            atSite: [LAND_WARDEN, WOLVES]
        })
        resolve(
            s,
            keeping(s, SALT, SearchPlay.Site, { cardId: LONGBOWS, play: SearchPlay.Adviser })
        )
        expect(s.denizensAt('c1')).toEqual([SALT])
        expect(s.getPlayerState('dana').faceupAdviserIds()).toContain(LONGBOWS)
    })

    it('a locked card at the site still refuses Salt, a modifier in use there or not', () => {
        const s = searched(FIXED, {
            top: [SALT, FILLER, FILLER],
            modifiers: [modifierUse(WELCOMING)],
            atSite: [WELCOMING, VOW_OF_UNION]
        })
        expect(checkOf(s, keeping(s, SALT, SearchPlay.Site))).toMatch(/locked/)
    })
})

describe('a salted site that keeps a modifier in use stays over its capacity (Law 2.8.1, 5.1.4)', () => {
    it("Land Warden's second card to that site is refused as full, on Dana's own view too", () => {
        const s = searched(FIXED, {
            top: [SALT, LONGBOWS, FILLER],
            modifiers: [modifierUse(LAND_WARDEN)],
            atSite: [LAND_WARDEN, WOLVES]
        })
        const choice = keeping(s, SALT, SearchPlay.Site, {
            cardId: LONGBOWS,
            play: SearchPlay.Site
        })
        expect(checkOf(s, choice)).toBe('second card: site c1 is at its capacity of 1')
        expect(checkOf(ownView(s), choice)).toBe('second card: site c1 is at its capacity of 1')
    })

    it('through the engine: the site holds two cards at capacity 1, a later play to it is refused, and the turn ends', () => {
        const game = testGame(['dana', 'rhys', 'chancellor'])
        let state: OathProjectedState = table(FIXED, {
            ...WELCOMING_AT_SITE,
            top: [SALT, FILLER, FILLER, INN, LONGBOWS, FILLER]
        }).dehydrate()
        state = engine.runNext(searchOf(WELCOMING_AT_SITE), state, game).updatedState
        const searchedOnce = new HydratedOathGameState(state)
        state = engine.runNext(
            buildAction(SearchResolve, {
                playerId: 'dana',
                ...keeping(searchedOnce, SALT, SearchPlay.Site)
            }),
            state,
            game
        ).updatedState
        const salted = new HydratedOathGameState(state)
        expect(sorted(salted.denizensAt('c1'))).toEqual(sorted([SALT, WELCOMING]))
        expect(effectiveSiteCapacity(salted, 'c1')).toBe(1)

        // A second Search: Longbows cannot go to the full site, but can be an adviser.
        state = engine.runNext(
            searchOf({ ...WELCOMING_AT_SITE, modifiers: [] }),
            state,
            game
        ).updatedState
        const again = new HydratedOathGameState(state)
        const play = (p: SearchPlay): GameAction =>
            buildAction(SearchResolve, { playerId: 'dana', ...keeping(again, LONGBOWS, p) })
        expect(() => engine.runNext(play(SearchPlay.Site), state, game)).toThrow(
            /site c1 is at its capacity of 1/
        )
        state = engine.runNext(play(SearchPlay.Adviser), state, game).updatedState
        expect(sorted(new HydratedOathGameState(state).denizensAt('c1'))).toEqual(
            sorted([SALT, WELCOMING])
        )
        expect(() =>
            engine.runNext(buildAction(EndActPhase, { playerId: 'dana' }), state, game)
        ).not.toThrow()
    })
})

describe('the When Played mass discards of a card kept from the Search (Law 7.4.3, 9.2)', () => {
    const RIOTS_TABLE: Table = {
        top: [RIOTS, FILLER, FILLER],
        modifiers: [modifierUse(WELCOMING)],
        atSite: [WELCOMING, WOLVES],
        atC2: [CROP_ROTATION],
        mob: true
    }

    it('Riots on the Mob side, hearth most common: Welcoming Party in use stays, Crop Rotation goes, and it pays once', () => {
        const s = searched(FIXED, RIOTS_TABLE)
        const { favor } = resolve(s, keeping(s, RIOTS, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WELCOMING, WOLVES])
        expect(s.denizensAt('c2')).toEqual([])
        expect(favor).toBe(1)
        expect(piled(s)).toContain(CROP_ROTATION)
        expect(piled(s)).not.toContain(WELCOMING)
    })

    it('Riots: control, Welcoming Party not declared is discarded', () => {
        const s = searched(FIXED, { ...RIOTS_TABLE, modifiers: [] })
        resolve(s, keeping(s, RIOTS, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WOLVES])
    })

    it('Riots: before revision 31, Welcoming Party in use is discarded and still pays', () => {
        const s = searched(BEFORE, RIOTS_TABLE)
        const { favor } = resolve(s, keeping(s, RIOTS, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WOLVES])
        expect(favor).toBe(1)
    })

    const DAZZLE_TABLE: Table = {
        top: [DAZZLE, FILLER, FILLER],
        modifiers: [modifierUse(WELCOMING)],
        atSite: [WELCOMING, WOLVES],
        atC2: [CROP_ROTATION]
    }

    it('Dazzle: Welcoming Party in use stays, Crop Rotation in the region goes, and it pays once', () => {
        const s = searched(FIXED, DAZZLE_TABLE)
        const { action, favor } = resolve(s, keeping(s, DAZZLE, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WELCOMING, WOLVES])
        expect(s.denizensAt('c2')).toEqual([])
        expect(favor).toBe(1)
        expect(piled(s)).toContain(CROP_ROTATION)
        expect(piled(s)).not.toContain(WELCOMING)
        expect(action.metadata?.whenPlayed).toContain('discarded 1 hearth and order cards')
    })

    it('Dazzle: control, Welcoming Party not declared is discarded', () => {
        const s = searched(FIXED, { ...DAZZLE_TABLE, modifiers: [] })
        resolve(s, keeping(s, DAZZLE, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WOLVES])
    })

    it('Dazzle: before revision 31, Welcoming Party in use is discarded and still pays', () => {
        const s = searched(BEFORE, DAZZLE_TABLE)
        const { favor } = resolve(s, keeping(s, DAZZLE, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WOLVES])
        expect(favor).toBe(1)
    })

    const ROAR_TABLE: Table = {
        top: [ROAR, FILLER, FILLER],
        modifiers: [modifierUse(WILD_CRY)],
        atSite: [WILD_CRY, WOLVES]
    }

    it('Threatening Roar: Wild Cry in use stays, the Wolves go, and Wild Cry pays its Supply once', () => {
        const s = searched(FIXED, ROAR_TABLE)
        const { supply } = resolve(s, keeping(s, ROAR, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([WILD_CRY])
        expect(supply).toBe(1)
        expect(piled(s)).toContain(WOLVES)
        expect(piled(s)).not.toContain(WILD_CRY)
    })

    it('Threatening Roar: control, Wild Cry not declared is discarded', () => {
        const s = searched(FIXED, { ...ROAR_TABLE, modifiers: [] })
        resolve(s, keeping(s, ROAR, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([])
    })

    it('Threatening Roar: before revision 31, Wild Cry in use is discarded and still pays', () => {
        const s = searched(BEFORE, ROAR_TABLE)
        const { supply } = resolve(s, keeping(s, ROAR, SearchPlay.Adviser))
        expect(s.denizensAt('c1')).toEqual([])
        expect(supply).toBe(1)
    })
})

describe('a spared Land Warden at the site counts for room (Land Warden, Law 2.8.1)', () => {
    // Dazzle discards hearth and order cards in the region; Land Warden (hearth) is in use and stays, so the
    // Plains still holds three cards when the second card would go there.
    const FULL: Table = {
        top: [DAZZLE, LONGBOWS, FILLER],
        modifiers: [modifierUse(LAND_WARDEN)],
        atSite: [LAND_WARDEN, WOLVES, RANGERS]
    }
    const choiceOf = (s: HydratedOathGameState) =>
        keeping(s, DAZZLE, SearchPlay.Adviser, { cardId: LONGBOWS, play: SearchPlay.Site })

    it("Dazzle kept as an adviser, Longbows second to the site: refused as full, on Dana's own view too", () => {
        const s = searched(FIXED, FULL)
        const server = JSON.stringify(s.dehydrate())
        expect(checkOf(s, choiceOf(s))).toBe('second card: site c1 is at its capacity of 3')
        const own = ownView(s)
        expect(checkOf(own, choiceOf(own))).toBe('second card: site c1 is at its capacity of 3')
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it('Dazzle kept as an adviser with no second card is accepted, and Land Warden in use stays', () => {
        const s = searched(FIXED, FULL)
        const choice = keeping(s, DAZZLE, SearchPlay.Adviser)
        expect(checkOf(s, choice)).toBeUndefined()
        resolve(s, choice)
        expect(s.denizensAt('c1')).toEqual([LAND_WARDEN, WOLVES, RANGERS])
    })

    it('before revision 31, Dazzle discards Land Warden and Longbows second to the site is accepted', () => {
        const s = searched(BEFORE, FULL)
        expect(checkOf(s, choiceOf(s))).toBeUndefined()
        resolve(s, choiceOf(s))
        expect(s.denizensAt('c1')).toEqual([WOLVES, RANGERS, LONGBOWS])
    })
})

describe('Hunting Party in use: its free Campaign comes from a card still in play (Law 7.4.3)', () => {
    const where = (s: HydratedOathGameState) =>
        siteHolding(s, HUNTING_PARTY) ??
        (s.getPlayerState('dana').hasAdviser(HUNTING_PARTY) ? 'adviser' : 'gone')
    const grantedBy = (s: HydratedOathGameState) => s.getPlayerState('dana').freeCampaignGrantedBy

    const cases: {
        name: string
        table: Omit<Table, 'modifiers'>
        extraModifiers?: ModifierUse[]
        choice: (s: HydratedOathGameState) => SearchResolveChoice
    }[] = [
        {
            name: 'Salt the Earth kept to its site',
            table: { top: [SALT, INN, FILLER], atSite: [HUNTING_PARTY, WOLVES] },
            choice: (s) => keeping(s, SALT, SearchPlay.Site)
        },
        {
            name: 'Dazzle kept as an adviser',
            table: { top: [DAZZLE, INN, FILLER], atSite: [HUNTING_PARTY] },
            choice: (s) => keeping(s, DAZZLE, SearchPlay.Adviser)
        },
        {
            name: 'Riots kept as an adviser, order most common',
            table: {
                top: [RIOTS, INN, FILLER],
                atSite: [HUNTING_PARTY],
                atC2: [KNIGHTS],
                mob: true
            },
            choice: (s) => keeping(s, RIOTS, SearchPlay.Adviser)
        },
        {
            name: "Land Warden's second card, Salt the Earth to its site",
            table: {
                top: [LONGBOWS, SALT, FILLER],
                atSite: [HUNTING_PARTY],
                advisers: [LAND_WARDEN]
            },
            extraModifiers: [modifierUse(LAND_WARDEN)],
            choice: (s) =>
                keeping(s, LONGBOWS, SearchPlay.Adviser, { cardId: SALT, play: SearchPlay.Site })
        }
    ]

    for (const c of cases) {
        const declared = [...(c.extraModifiers ?? []), modifierUse(HUNTING_PARTY)]

        it(`${c.name}: Hunting Party stays at its site, and the free Campaign is granted`, () => {
            const s = searched(FIXED, { ...c.table, modifiers: declared })
            expect(checkOf(ownView(s), c.choice(s))).toBeUndefined()
            resolve(s, c.choice(s))
            expect({ at: where(s), grantedBy: grantedBy(s) }).toEqual({
                at: 'c1',
                grantedBy: HUNTING_PARTY
            })
        })

        it(`${c.name}: before revision 31, Hunting Party is discarded and the Campaign still granted`, () => {
            const s = searched(BEFORE, { ...c.table, modifiers: declared })
            resolve(s, c.choice(s))
            expect({ at: where(s), grantedBy: grantedBy(s) }).toEqual({
                at: 'gone',
                grantedBy: HUNTING_PARTY
            })
        })
    }

    it('control: Hunting Party not declared is discarded by Salt, and no Campaign is granted', () => {
        const s = searched(FIXED, {
            top: [SALT, INN, FILLER],
            atSite: [HUNTING_PARTY, WOLVES],
            modifiers: []
        })
        resolve(s, keeping(s, SALT, SearchPlay.Site))
        expect({ at: where(s), grantedBy: grantedBy(s) }).toEqual({
            at: 'gone',
            grantedBy: undefined
        })
    })
})
