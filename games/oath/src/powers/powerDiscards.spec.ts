import { PowerQuestionKind } from '../model/question.js'
import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { Banner, Region } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { PileDeposit } from '../model/hidden.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { type PowerChoice } from '../util/powerChoice.js'
import { discardCards } from '../util/discard.js'
import { commitHiddenOutputs } from '../util/hiddenInputs.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import './index.js'
import { buildAction } from '../testing/actions.js'
import { card, player, actionPowerUse, modifierUse } from '../testing/choices.js'
import { INN, FILLER } from '../testing/cards.js'
import { answerQuestion, discardInListedOrder, playDrawnCard } from '../testing/steps.js'
import { expectCountsMatchTheVault } from '../testing/census.js'

/** R-9.4 — `commitHiddenOutputs` replays a power's `pileDeposits` into the vault. */
const ASSASSIN = 'denizen.discord.assassin'
const MOB = 'denizen.hearth.armed-mob'
const TAMING = 'denizen.arcane.taming-charm'
const HOMESTEADERS = 'denizen.hearth.homesteaders'
const ROVING = 'denizen.beast.roving-terror'
const RIOTS = 'denizen.discord.riots'
const DAZZLE = 'denizen.arcane.dazzle'
const ROAR = 'denizen.beast.threatening-roar'
const SALT = 'denizen.discord.salt-the-earth'
const LAND_WARDEN = 'denizen.hearth.land-warden'

const STORYTELLER = 'denizen.hearth.storyteller'
const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
const CAPTAINS = 'denizen.order.captains'
const WOLVES = 'denizen.beast.wolves'
const RANGERS = 'denizen.beast.rangers'
const TENTS = 'denizen.nomad.tents'
const ELDERS = 'denizen.nomad.elders'
const SCOUTS = 'denizen.order.scouts'

const ME = 'me'
const FOE = 'foe'

const toProvinces = (...cardIds: string[]): PileDeposit => ({ region: Region.Provinces, cardIds })

/** R-10.5 — c1 is in the Cradle, so its discards go to the Provinces. */
function board(cards: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 4, supply: 6, warbandsOnBoard: { [ME]: 4 }, warbandsInPersonalBank: { [ME]: 6 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1', favor: 2, secrets: 2, warbandsOnBoard: { [FOE]: 2 }, ...over[FOE] })
        ],
        {
            denizensBySite: { c1: cards, c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [ME]: 1 }, c2: { [ME]: 2 }, p1: { [FOE]: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, ME)
    return s
}

function use(s: HydratedOathGameState, cardId: string, choices: PowerChoice[]) {
    const a = actionPowerUse(ME, cardId, choices)
    a.apply(s)
    return a
}

function search(s: HydratedOathGameState, cardId: string, to: SearchPlay, choices?: PowerChoice[]) {
    return playDrawnCard(s, cardId, to, choices, ME)
}

/** The pile reads top first; `under` holds the action's own discards, made before the power's. */
function expectDeposited(s: HydratedOathGameState, action: { revealsInfo?: boolean; metadata?: { pileDeposits?: PileDeposit[] } }, deposits: PileDeposit[], under: string[] = []) {
    expect(action.metadata?.pileDeposits).toEqual(deposits)
    const onTop = deposits.flatMap((deposit) => deposit.cardIds).reverse()
    expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([...onTop, ...under])
    expect(action.revealsInfo).toBe(true)
    expectCountsMatchTheVault(s)
}

describe('an Action power that discards records the deposit on UseActionPower', () => {
    it('Assassin: the adviser it discards', () => {
        const s = board([ASSASSIN], { [FOE]: { advisers: [{ cardId: RANGERS, faceUp: true }] } })
        expectDeposited(s, use(s, ASSASSIN, [player(FOE), card(RANGERS)]), [toProvinces(RANGERS)])
    })

    it('Armed Mob: the adviser it discards', () => {
        const dark = { banners: { [Banner.DarkestSecret]: { holderPlayerId: FOE, value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board([MOB], { [FOE]: { advisers: [{ cardId: SCOUTS, faceUp: true }] } }, dark)
        expectDeposited(s, use(s, MOB, [player(FOE), card(SCOUTS)]), [toProvinces(SCOUTS)])
    })

    it('Taming Charm: the beast it discards', () => {
        const s = board([TAMING, WOLVES])
        expectDeposited(s, use(s, TAMING, [card(WOLVES)]), [toProvinces(WOLVES)])
    })

    it('Homesteaders: the Great Slum card it discards first (R-11.10)', () => {
        const s = board([WOLVES, TENTS, STORYTELLER], { [ME]: { advisers: [{ cardId: HOMESTEADERS, faceUp: true }, { cardId: INN, faceUp: true }] } }, { siteCards: { c1: 'site.great-slums', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        expectDeposited(s, use(s, HOMESTEADERS, [card(INN), card(WOLVES)]), [toProvinces(WOLVES)])
        expect(s.denizensBySite['c1']).toEqual([TENTS, STORYTELLER, INN])
    })

    it('Roving Terror: both discards, the Great Slum card first and then the target', () => {
        const s = board([ROVING], {}, { denizensBySite: { c1: [ROVING], c2: [INN, WOLVES], p1: [], h1: [] }, siteCards: { c1: 'site.plains', c2: 'site.great-slums', p1: 'site.marshes', h1: 'site.mountain' } })
        expectDeposited(s, use(s, ROVING, [card(INN), card(WOLVES)]), [toProvinces(WOLVES), toProvinces(INN)])
        expect(s.denizensBySite['c2']).toEqual([ROVING])
    })
})

describe('a When Played power that discards several cards records the deposit on the answer that orders them', () => {
    const mob = { banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: true }, [Banner.DarkestSecret]: { value: 1 } } }

    it("Riots: every card of the map's most common suit, site by site", () => {
        const s = board([], {}, { ...mob, denizensBySite: { c1: [INN], c2: [WOLVES, STORYTELLER], p1: [ELDERS], h1: [] } })
        search(s, RIOTS, SearchPlay.Site)
        expectDeposited(s, discardInListedOrder(s), [toProvinces(INN, STORYTELLER)], [FILLER])
    })

    it('Dazzle: the hearth and order cards in the region', () => {
        const s = board([ROWDY_PUB], {}, { denizensBySite: { c1: [ROWDY_PUB], c2: [CAPTAINS, RANGERS], p1: [], h1: [STORYTELLER] } })
        search(s, DAZZLE, SearchPlay.Adviser)
        expectDeposited(s, discardInListedOrder(s), [toProvinces(ROWDY_PUB, CAPTAINS)], [FILLER])
    })

    it('Threatening Roar: the nomad and beast cards in the region, itself included', () => {
        const s = board([], {}, { denizensBySite: { c1: [], c2: [TENTS], p1: [], h1: [] } })
        search(s, ROAR, SearchPlay.Site)
        expectDeposited(s, discardInListedOrder(s), [toProvinces(ROAR, TENTS)], [FILLER])
    })

    it('Salt the Earth: the other denizens at its site', () => {
        const s = board([INN, WOLVES])
        search(s, SALT, SearchPlay.Site)
        expectDeposited(s, discardInListedOrder(s), [toProvinces(INN, WOLVES)], [FILLER])
    })

    it("Land Warden's second play: its When Played deposit is recorded too", () => {
        const s = board([], { [ME]: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] } }, { denizensBySite: { c1: [], c2: [WOLVES], p1: [], h1: [] } })
        s.requireVault().worldDeck = [INN, ROAR, FILLER]
        new HydratedSearch(buildAction(Search, { playerId: ME, drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })).apply(s)
        const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: ME, keptCardId: INN, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: { cardId: ROAR, play: SearchPlay.Adviser, faceUp: true } }))
        a.apply(s)
        expectDeposited(s, a, [toProvinces(WOLVES)], [FILLER])
    })
})

describe('Law Glossary "Discard" — several cards for one pile go in the discarder\'s order', () => {
    it('Salt the Earth: the order given is the order they land, the last on top', () => {
        const s = board([INN, WOLVES])
        search(s, SALT, SearchPlay.Site)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.OrderDiscards, askedPlayerId: ME, cardIds: [INN, WOLVES] })
        answerQuestion(s, ME, { kind: PowerQuestionKind.OrderDiscards, order: [1, 0] })
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([INN, WOLVES, FILLER])
    })
})

describe('the deposit itself', () => {
    it('discardCards returns what it put on a pile: the next region, a named pile and its bottom, nothing under the world deck', () => {
        const s = board()
        expect(discardCards(s, ME, [INN], Region.Cradle)).toEqual([toProvinces(INN)])
        expect(discardCards(s, ME, [WOLVES], Region.Cradle, { region: Region.Hinterland, bottom: true })).toEqual([{ region: Region.Hinterland, cardIds: [WOLVES], bottom: true }])
        expect(discardCards(s, ME, [TENTS], Region.Cradle, { region: Region.Cradle, bottom: false, worldDeck: true })).toEqual([])
        expect(discardCards(s, ME, [], Region.Cradle)).toEqual([])
    })

    it('a deposit under a pile goes to its bottom in the vault', () => {
        const s = board()
        s.requireVault().discardPiles[Region.Hinterland] = [INN]
        const recorded = new HydratedUseActionPower(buildAction(UseActionPower, { playerId: ME, cardId: TAMING, powerIndex: powerIndexOf(TAMING, PowerTiming.Action), metadata: { summary: 'test', pileDeposits: [{ region: Region.Hinterland, cardIds: [WOLVES, TENTS], bottom: true }] } }))
        commitHiddenOutputs(recorded, s, { byCard: new Map(), setsByCard: new Map(), handSetsByCard: new Map(), holders: true, sets: new Set(), relics: new Map() })
        expect(s.requireVault().discardPiles[Region.Hinterland]).toEqual([INN, WOLVES, TENTS])
    })

    it('nothing to deposit: a power that discards nothing records nothing and stays undoable', () => {
        const s = board([], {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [] } })
        const a = search(s, ROAR, SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toMatch(/discarded 0/)
        expect(a.metadata?.pileDeposits).toBeUndefined()

        const u = board([], { [ME]: { advisers: [{ cardId: HOMESTEADERS, faceUp: true }, { cardId: INN, faceUp: true }] } })
        const moved = use(u, HOMESTEADERS, [card(INN)])
        expect(u.denizensBySite['c1']).toEqual([INN])
        expect(moved.metadata?.pileDeposits).toBeUndefined()
        expect(moved.revealsInfo).toBe(false)
    })
})
