import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearch, Search, SearchSource } from './search.js'
import {
    HydratedSearchResolve,
    SearchPlay,
    SearchResolve,
    reasonCannotPairSecondPlay,
    type SearchSecondPlay
} from './searchResolve.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import type { OathVault } from '../model/vault.js'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { modifierUse, yes } from '../testing/choices.js'
import { FILLER, INN, TENTS } from '../testing/cards.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const LAND_WARDEN = 'denizen.hearth.land-warden'
const WOLVES = 'denizen.beast.wolves'
const HEIR = 'denizen.beast.long-lost-heir'
const DAZZLE = 'denizen.arcane.dazzle'
const SADDLE_MAKERS = 'denizen.hearth.saddle-makers'
const ORDER_CARD = 'denizen.order.longbows'

/**
 * Dana, an Exile at c1 (Fertile Valley, whose Homeland pays a Hearth card a Hearth favor), holds Land Warden;
 * Rhys holds `rhysAdvisers`; Ann is the Chancellor. The world deck's top three are `deck`.
 */
function table(
    deck: string[],
    options: {
        oathRevision?: number
        rhysAdvisers?: string[]
        atC1?: string[]
        siteCards?: Record<string, string>
        relicsBySite?: Record<string, { slotId: string }[]>
        vault?: OathVault
    } = {}
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'dana',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 6,
                warbandsOnBoard: { dana: 3 },
                warbandsInPersonalBank: { dana: 6 },
                advisers: [{ cardId: LAND_WARDEN, faceUp: true }]
            }),
            testPlayer({
                playerId: 'rhys',
                color: Color.Blue,
                siteId: 'c2',
                favor: 2,
                secrets: 2,
                advisers: (options.rhysAdvisers ?? []).map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 }
            })
        ],
        {
            oathRevision: options.oathRevision ?? OathRevision.EngineFixes8,
            chancellorPlayerId: 'ann',
            denizensBySite: { c1: options.atC1 ?? [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { dana: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: options.siteCards ?? {
                c1: 'site.fertile-valley',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...(options.relicsBySite ? { relicsBySite: options.relicsBySite } : {}),
            ...(options.vault ? { vault: options.vault } : {})
        }
    )
    openTurn(s, 'dana')
    s.requireVault().worldDeck = deck
    return s
}

const search = buildAction(Search, {
    playerId: 'dana',
    drawFrom: SearchSource.WorldDeck,
    revealsInfo: true,
    modifiers: [modifierUse(LAND_WARDEN)]
})

function resolveAction(
    fields: Partial<SearchResolve> & Pick<SearchResolve, 'keptCardId' | 'play'>
) {
    return buildAction(SearchResolve, { playerId: 'dana', discardOrder: [FILLER], ...fields })
}

/** The Search's resolve, on a state that has drawn. */
function resolveOn(s: HydratedOathGameState, fields: Parameters<typeof resolveAction>[0]) {
    const a = new HydratedSearchResolve(resolveAction(fields))
    a.apply(s)
    return a
}

/** The Search drawn and resolved on the state as the server holds it. */
function searchAndResolve(s: HydratedOathGameState, fields: Parameters<typeof resolveAction>[0]) {
    new HydratedSearch(search).apply(s)
    return resolveOn(s, fields)
}

/** The Search drawn and resolved through the state machine: the steps that follow it, and where they leave the game. */
function machineAfter(s: HydratedOathGameState, fields: Parameters<typeof resolveAction>[0]) {
    const game = testGame(['dana', 'rhys', 'ann'])
    const drawn = engine.runNext(structuredClone(search), s.dehydrate(), game)
    const resolved = engine.runNext(resolveAction(fields), drawn.updatedState, game)
    return {
        state: new HydratedOathGameState(resolved.updatedState),
        steps: resolved.processedActions.map((action) => action.type)
    }
}

const toSite = (cardId: string): SearchSecondPlay => ({ cardId, play: SearchPlay.Site })
const faceupAdviser = (cardId: string): SearchSecondPlay => ({
    cardId,
    play: SearchPlay.Adviser,
    faceUp: true
})

describe("Land Warden — the Search records both cards' plays in full", () => {
    it('both cards to the site: the favor of each is recorded, 2, and the second card’s Homeland in its own field', () => {
        const s = table([WOLVES, INN, FILLER])
        const banks = { beast: s.favorBank[Suit.Beast], hearth: s.favorBank[Suit.Hearth] }
        new HydratedSearch(search).apply(s)
        const favor = s.getPlayerState('dana').favor
        const a = resolveOn(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: toSite(INN)
        })

        expect(s.denizensBySite['c1']).toEqual([WOLVES, INN])
        // A favor for each card played to a site, and the Fertile Valley's Hearth favor for the Inn.
        expect(s.getPlayerState('dana').favor).toBe(favor + 3)
        expect(banks.beast - s.favorBank[Suit.Beast]).toBe(1)
        expect(banks.hearth - s.favorBank[Suit.Hearth]).toBe(2)
        expect(a.metadata?.favorGained).toBe(2)
        expect(a.metadata?.sitePower).toBeUndefined()
        expect(a.metadata?.secondSitePower).toBe('Fertile Valley (Homeland): gained 1 hearth favor')
    })

    it("before revision 12 the favor recorded is the kept card's, as such a game recorded it; the Homeland is recorded at every revision", () => {
        const s = table([WOLVES, INN, FILLER], { oathRevision: OathRevision.EngineFixes7 })
        new HydratedSearch(search).apply(s)
        const favor = s.getPlayerState('dana').favor
        const a = resolveOn(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: toSite(INN)
        })
        expect(s.getPlayerState('dana').favor).toBe(favor + 3)
        expect(a.metadata?.favorGained).toBe(1)
        expect(a.metadata?.secondSitePower).toBe('Fertile Valley (Homeland): gained 1 hearth favor')
    })

    it('a second card at the Deep Woods takes no relic, since its play draws none, and the record says so', () => {
        const s = table([INN, WOLVES, FILLER], {
            siteCards: {
                c1: 'site.deep-woods',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            vault: testVaultWithRelics({ 'c1-r1': 'relic.map' })
        })
        const a = searchAndResolve(s, {
            keptCardId: INN,
            play: SearchPlay.Site,
            secondPlay: toSite(WOLVES)
        })
        expect(s.getPlayerState('dana').relicIds).toEqual([])
        expect(s.relicSlotsAt('c1')).toHaveLength(1)
        expect(a.metadata?.sitePower).toBeUndefined()
        expect(a.metadata?.secondSitePower).toBe(
            'Deep Woods (Homeland): no relic was drawn for this play, so none was taken'
        )
    })

    it("the kept card's Homeland stays in its own field, and a second card without one adds none", () => {
        const s = table([INN, WOLVES, FILLER])
        const a = searchAndResolve(s, {
            keptCardId: INN,
            play: SearchPlay.Site,
            secondPlay: toSite(WOLVES)
        })
        expect(a.metadata?.favorGained).toBe(2)
        expect(a.metadata?.sitePower).toBe('Fertile Valley (Homeland): gained 1 hearth favor')
        expect(a.metadata?.secondSitePower).toBeUndefined()
    })

    it('a second card played facedown gains no favor and resolves no When Played power', () => {
        const s = table([WOLVES, DAZZLE, FILLER])
        const a = searchAndResolve(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: { cardId: DAZZLE, play: SearchPlay.Adviser, faceUp: false }
        })
        expect(a.metadata?.favorGained).toBe(1)
        expect(a.metadata?.secondWhenPlayed).toBeUndefined()
        expect(a.metadata?.secondSitePower).toBeUndefined()
    })

    it("Saddle Makers pays for each card: both cards' triggers are recorded, the kept card's first", () => {
        const s = table([ORDER_CARD, TENTS, FILLER], { rhysAdvisers: [SADDLE_MAKERS] })
        const a = searchAndResolve(s, {
            keptCardId: ORDER_CARD,
            play: SearchPlay.Site,
            secondPlay: toSite(TENTS)
        })
        expect(a.metadata?.triggered).toEqual([
            'Saddle Makers: rhys gained 2 favor from the order bank',
            'Saddle Makers: rhys gained 2 favor from the nomad bank'
        ])
    })

    it('Saddle Makers on the second card alone is recorded too', () => {
        const s = table([WOLVES, TENTS, FILLER], { rhysAdvisers: [SADDLE_MAKERS] })
        const a = searchAndResolve(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: toSite(TENTS)
        })
        expect(a.metadata?.triggered).toEqual([
            'Saddle Makers: rhys gained 2 favor from the nomad bank'
        ])
    })

    it("the cards a second card's When Played discards are on the record with the kept card's, as before (Dazzle)", () => {
        const s = table([WOLVES, DAZZLE, FILLER], { atC1: [INN] })
        const a = searchAndResolve(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: faceupAdviser(DAZZLE)
        })
        expect(s.denizensBySite['c1']).toEqual([WOLVES])
        expect(a.metadata?.pileDeposits?.flatMap((deposit) => deposit.cardIds)).toContain(INN)
        expect(a.revealsInfo).toBe(true)
    })

    it('two faceup advisers are refused: one card must go to a site', () => {
        const s = table([WOLVES, DAZZLE, FILLER])
        new HydratedSearch(search).apply(s)
        expect(
            reasonCannotPairSecondPlay(s, 'dana', SearchPlay.Adviser, faceupAdviser(DAZZLE))
        ).toBeDefined()
    })
})

describe('Land Warden — the end of the Act Phase after both plays (R-7.3.3)', () => {
    it("the kept card's When Played ends the Act Phase and the second card's does not: Dana's turn goes to the Rest", () => {
        const s = table([HEIR, WOLVES, FILLER])
        const { state, steps } = machineAfter(s, {
            keptCardId: HEIR,
            play: SearchPlay.Adviser,
            faceUp: true,
            choices: [yes],
            secondPlay: toSite(WOLVES)
        })
        expect(state.getPlayerState('dana').status).toBe(PlayerStatus.Citizen)
        expect(steps).toContain(ActionType.CompleteRest)
        expect(state.activePlayerIds).toEqual(['rhys'])
        // Dana's site folds into the Chancellor's: the title is judged once, after the whole Search step.
        expect(steps.filter((step) => step === ActionType.TransferOathkeeper)).toHaveLength(1)
        expect(steps.indexOf(ActionType.TransferOathkeeper)).toBe(1)
    })

    it('the second card is asked no When Played choice, so its "may" is not taken and Dana stays in their Act Phase', () => {
        // The second card's play carries no choices; a When Played "may" resolves as declined.
        const s = table([WOLVES, HEIR, FILLER])
        const { state, steps } = machineAfter(s, {
            keptCardId: WOLVES,
            play: SearchPlay.Site,
            secondPlay: faceupAdviser(HEIR)
        })
        expect(state.getPlayerState('dana').status).toBe(PlayerStatus.Exile)
        expect(steps).toEqual([ActionType.SearchResolve])
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['dana'])
    })
})
