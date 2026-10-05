import { describe, expect, it } from 'vitest'
import { machineContext, buildAction } from '../testing/actions.js'
import { Color } from '@tabletop/common'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { type ModifierUse, usableModifiers } from '../util/modifiers.js'
import '../powers/index.js'
import { required } from '../testing/required.js'
import { modifierUse } from '../testing/choices.js'
import { INN } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

const TENTS = 'denizen.nomad.tents'
const STEED = 'denizen.nomad.a-fast-steed'
const ENVOY = 'denizen.nomad.special-envoy'
const PORTAL = 'denizen.arcane.portal'
const TYRANT = 'denizen.order.tyrant'
const PUB = 'denizen.hearth.rowdy-pub'
const PLAYMATES = 'denizen.beast.animal-playmates'
const DOWNTRODDEN = 'denizen.discord.downtrodden'
const PRESSGANGS = 'denizen.order.pressgangs'
const RETURN = 'denizen.hearth.awaited-return'
const BIRDSONG = 'denizen.beast.birdsong'
const SIGNAL = 'denizen.arcane.secret-signal'
const OAK = 'denizen.beast.the-old-oak'
const AUGURY = 'denizen.arcane.augury'
const PARTY = 'denizen.hearth.welcoming-party'
const CRY = 'denizen.beast.wild-cry'

/** c1 and c2 are in the Cradle, p1 in the Provinces. */
function board(
    cards: string[],
    advisers: string[] = [],
    over: Record<string, unknown> = {},
    ruler: Record<string, unknown> = {}
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 2,
                supply: 3,
                warbandsOnBoard: { ruler: 2 },
                warbandsInPersonalBank: { ruler: 5 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true })),
                ...ruler
            }),
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { other: 2 },
                warbandsInPersonalBank: { other: 5 }
            })
        ],
        {
            denizensBySite: { c1: cards, c2: [], p1: [] },
            warbandsBySite: { c1: { ruler: 1 }, c2: { other: 3, ruler: 1 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' },
            ...over
        }
    )
    openTurn(s, 'ruler')
    return s
}

function travel(siteId: string, modifiers?: ModifierUse[]) {
    return new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId, modifiers }))
}
function muster(cardId: string, modifiers?: ModifierUse[]) {
    return new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId, modifiers }))
}
function trade(cardId: string, option: TradeOption, modifiers?: ModifierUse[]) {
    return new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId, option, modifiers }))
}

describe('the modifier framework (R-7.4)', () => {
    it('refuses a modifier declared on the wrong major action', () => {
        const s = board([TENTS])
        expect(() => muster(INN, [modifierUse(TENTS)]).apply(board([TENTS, INN]))).toThrow(/modifies travel, not muster/)
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'c2', [modifierUse(TENTS)])).toBeUndefined()
    })

    it('refuses the same modifier declared twice on one action (R-7.4.2)', () => {
        const s = board([ENVOY])
        expect(() => travel('c2', [modifierUse(ENVOY), modifierUse(ENVOY)]).apply(s)).toThrow(/declared twice/)
    })

    it('refuses a modifier the player has no access to (R-7.1.1)', () => {
        const s = board([], [], { denizensBySite: { c1: [], c2: [], p1: [ENVOY] } })
        expect(() => travel('p1', [modifierUse(ENVOY)]).apply(s)).toThrow(/neither rule/)
    })

    it('refuses a modifier used through UseActionPower', () => {
        const s = board([ENVOY])
        const action = new HydratedUseActionPower(
            buildAction(UseActionPower, { playerId: 'ruler', cardId: ENVOY, powerIndex: modifierUse(ENVOY).powerIndex })
        )
        expect(() => action.apply(s)).toThrow()
    })

    it('refuses a declared modifier whose printed condition does not hold (R-7.4.1)', () => {
        const s = board([TENTS])
        expect(() => travel('p1', [modifierUse(TENTS)]).apply(s)).toThrow(/not in your region/)
        expect(s.getPlayerState('ruler').favor).toBe(3)
    })
})

describe('Travel modifiers', () => {
    it('R-7.4 — a destination the declared modifier makes affordable is legal (Tents at 0 Supply)', () => {
        const s = board([TENTS], [], {}, { supply: 0 })
        expect(HydratedTravel.legalDestinations(s, 'ruler')).not.toContain('c2')
        expect(HydratedTravel.legalDestinations(s, 'ruler', [modifierUse(TENTS)])).toContain('c2')
    })

    it('Tents: places one favor and waives Supply for an in-region move', () => {
        const s = board([TENTS])
        travel('c2', [modifierUse(TENTS)]).apply(s)
        const p = s.getPlayerState('ruler')
        expect(p.siteId).toBe('c2')
        expect(p.supply).toBe(3)
        expect(p.favor).toBe(2)
        expect(s.tokensOn(TENTS).favor).toBe(1)
    })

    it('A Fast Steed: waives with three or fewer warbands on the board, refuses with four', () => {
        const s = board([STEED])
        travel('p1', [modifierUse(STEED)]).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(s.getPlayerState('ruler').favor).toBe(2)

        const many = board([STEED], [], {}, { warbandsOnBoard: { ruler: 4 } })
        expect(() => travel('p1', [modifierUse(STEED)]).apply(many)).toThrow(/more than three/)
    })

    it('Special Envoy: free, and the handler ends the Act Phase afterwards', () => {
        const s = board([ENVOY])
        const action = travel('p1', [modifierUse(ENVOY)])
        action.apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(action.metadata?.endsActPhase).toBe(true)
        const handler = new ActPhaseStateHandler()
        expect(handler.onAction(action, machineContext(s))).toBe(MachineState.RestPhase)
        expect(handler.onAction(travel('p1'), machineContext(s))).toBe(MachineState.ActPhase)
    })

    it('Portal: places a secret and waives Supply when travelling from its site; refuses otherwise', () => {
        const s = board([PORTAL])
        travel('p1', [modifierUse(PORTAL)]).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(s.getPlayerState('ruler').secrets).toBe(1)
        expect(s.tokensOn(PORTAL).secrets).toBe(1)

        // The Portal is at c2, held as an adviser for access; c1→p1 touches neither end of it.
        const held = board([], [PORTAL], { denizensBySite: { c1: [], c2: [PORTAL], p1: [] } })
        expect(() => travel('p1', [modifierUse(PORTAL)]).apply(held)).toThrow(/neither to nor from/)
    })

    it('Tyrant is mandatory: kills a warband at the destination unasked, and cannot be declared', () => {
        const s = board([], [TYRANT])
        travel('c2').apply(s)
        expect(s.warbandsBySite.c2).toEqual({ other: 2, ruler: 1 })
        expect(() => travel('c2', [modifierUse(TYRANT)]).apply(board([], [TYRANT]))).toThrow(/mandatory/)
    })

    it('Tyrant: "if able" — an empty destination kills nothing and the Travel still resolves', () => {
        const s = board([], [TYRANT])
        travel('p1').apply(s)
        expect(s.getPlayerState('ruler').siteId).toBe('p1')
        expect(s.warbandsBySite.p1).toBeUndefined()
    })

    it('without Tyrant the destination is untouched (the mandatory fold is access-gated)', () => {
        const s = board([])
        travel('c2').apply(s)
        expect(s.warbandsBySite.c2).toEqual({ other: 3, ruler: 1 })
    })
})

describe('Muster modifiers', () => {
    it('Rowdy Pub: one more warband when mustering on it, refused elsewhere', () => {
        const s = board([PUB, INN])
        muster(PUB, [modifierUse(PUB)]).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(5)
        expect(s.getPlayerState('ruler').supply).toBe(2)
        expect(() => muster(INN, [modifierUse(PUB)]).apply(board([PUB, INN]))).toThrow(/not mustering on Rowdy Pub/)
    })

    it('Animal Playmates: no Supply on a beast card, refused on a hearth card', () => {
        const s = board([BIRDSONG, INN], [PLAYMATES])
        muster(BIRDSONG, [modifierUse(PLAYMATES)]).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
        expect(() => muster(INN, [modifierUse(PLAYMATES)]).apply(board([BIRDSONG, INN], [PLAYMATES]))).toThrow(/not a beast card/)
    })

    it('Downtrodden: two more warbands only when the card\'s bank is strictly least', () => {
        const least = { ...Object.fromEntries(Object.values(Suit).map((x) => [x, 3])), [Suit.Hearth]: 1 }
        const s = board([DOWNTRODDEN, INN], [], { favorBank: least })
        muster(INN, [modifierUse(DOWNTRODDEN)]).apply(s)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(6)

        const tied = { ...least, [Suit.Beast]: 1 }
        expect(() => muster(INN, [modifierUse(DOWNTRODDEN)]).apply(board([DOWNTRODDEN, INN], [], { favorBank: tied }))).toThrow(
            /not strictly the least/
        )
    })

    it('Pressgangs: lifts R-7.1.2.a so an occupied card can be mustered on', () => {
        const occupied = { cardTokens: { [INN]: { favor: 1, secrets: 0 } } }
        expect(() => muster(INN).apply(board([PRESSGANGS, INN], [], occupied))).toThrow()
        const s = board([PRESSGANGS, INN], [], occupied)
        muster(INN, [modifierUse(PRESSGANGS)]).apply(s)
        expect(s.tokensOn(INN).favor).toBe(2)
        expect(s.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
    })
})

describe('Trade modifiers', () => {
    it('Awaited Return: sacrifices a warband from the board and waives Supply', () => {
        const s = board([RETURN, INN])
        const action = trade(INN, TradeOption.ForFavor, [modifierUse(RETURN)])
        action.apply(s)
        const p = s.getPlayerState('ruler')
        expect(p.supply).toBe(3)
        expect(p.warbandsOnBoard['ruler']).toBe(1)
        expect(p.favor).toBe(4)
        expect(action.metadata?.modifierNotes?.[0]).toMatch(/sacrificed/)

        const none = board([RETURN, INN], [], {}, { warbandsOnBoard: {} })
        expect(() => trade(INN, TradeOption.ForFavor, [modifierUse(RETURN)]).apply(none)).toThrow(/no warband/)
    })

    it('Birdsong: no Supply trading with a beast or nomad card, refused on hearth', () => {
        const s = board([OAK, INN], [BIRDSONG])
        trade(OAK, TradeOption.ForFavor, [modifierUse(BIRDSONG)]).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(() => trade(INN, TradeOption.ForFavor, [modifierUse(BIRDSONG)]).apply(board([OAK, INN], [BIRDSONG]))).toThrow(
            /neither a beast nor a nomad/
        )
    })

    it('Secret Signal: a one-favor gain becomes two; a larger gain is untouched', () => {
        const s = board([INN], [SIGNAL])
        trade(INN, TradeOption.ForFavor, [modifierUse(SIGNAL)]).apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(5)

        const matching = board([INN], [SIGNAL, PARTY])
        trade(INN, TradeOption.ForFavor, [modifierUse(SIGNAL)]).apply(matching)
        expect(matching.getPlayerState('ruler').favor).toBe(5)

        expect(() => trade(INN, TradeOption.ForSecrets, [modifierUse(SIGNAL)]).apply(board([INN], [SIGNAL]))).toThrow(
            /not trading for favor/
        )
    })

    it('The Old Oak: one more secret trading with it for secrets with a beast adviser', () => {
        const s = board([OAK], [BIRDSONG])
        trade(OAK, TradeOption.ForSecrets, [modifierUse(OAK)]).apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(4)

        expect(() => trade(OAK, TradeOption.ForSecrets, [modifierUse(OAK)]).apply(board([OAK]))).toThrow(/no beast adviser/)
        expect(() => trade(OAK, TradeOption.ForFavor, [modifierUse(OAK)]).apply(board([OAK], [BIRDSONG]))).toThrow(
            /not trading for secrets/
        )
    })

    it('a declared modifier that asks which trade leaves its cards among the cards to trade with', () => {
        expect(HydratedTrade.legalCards(board([INN], [SIGNAL]), 'ruler', [modifierUse(SIGNAL)])).toEqual([INN])
        expect(HydratedTrade.legalCards(board([OAK], [BIRDSONG]), 'ruler', [modifierUse(OAK)])).toEqual([OAK])
    })

    it('the wanted count a client reads before a trade is what the trade then asks for', () => {
        const wantedOf = (state: ReturnType<typeof board>, cardId: string, option: TradeOption, used: ModifierUse[]) => {
            const { active } = HydratedTrade.plan(state, 'ruler', cardId, option, used)
            const matching = HydratedTrade.matchingAdvisers(state, 'ruler', cardId, active)
            return HydratedTrade.wanted(state, 'ruler', cardId, option, active, matching)
        }
        const signal = board([INN], [SIGNAL])
        expect(wantedOf(signal, INN, TradeOption.ForFavor, [modifierUse(SIGNAL)])).toBe(2)
        trade(INN, TradeOption.ForFavor, [modifierUse(SIGNAL)]).apply(signal)
        expect(signal.getPlayerState('ruler').favor).toBe(3 + 2)

        const oak = board([OAK], [BIRDSONG])
        expect(wantedOf(oak, OAK, TradeOption.ForSecrets, [modifierUse(OAK)])).toBe(2)
        trade(OAK, TradeOption.ForSecrets, [modifierUse(OAK)]).apply(oak)
        expect(oak.getPlayerState('ruler').secrets).toBe(2 + 2)
    })
})

describe('Search modifiers', () => {
    function search(modifiers: ModifierUse[] | undefined, drawn: string[]) {
        const action = new HydratedSearch(
            buildAction(Search, {
                playerId: 'ruler',
                drawFrom: SearchSource.WorldDeck,
                revealsInfo: true,
                modifiers
            })
        )
        return {
            apply(state: Parameters<HydratedSearch['apply']>[0]) {
                state.requireVault().worldDeck = [...drawn]
                action.apply(state)
            }
        }
    }
    function resolve(kept: string, discards: string[]) {
        return new HydratedSearchResolve(
            buildAction(SearchResolve, {
                playerId: 'ruler',
                keptCardId: kept,
                discardOrder: discards,
                play: SearchPlay.Adviser,
                faceUp: true
            })
        )
    }

    it('Augury: the resolver-facing draw count is one more', () => {
        const s = board([AUGURY])
        expect(HydratedSearch.drawCount(s, 'ruler')).toBe(3)
        expect(HydratedSearch.drawCount(s, 'ruler', [modifierUse(AUGURY)])).toBe(4)
    })

    it('Welcoming Party rides the Search to its resolve and pays on a denizen play', () => {
        const s = board([PARTY])
        search([modifierUse(PARTY)], [RETURN, TENTS]).apply(s)
        expect(s.pendingSearchModifiers).toEqual([{ cardId: PARTY, powerIndex: modifierUse(PARTY).powerIndex }])
        const before = s.favorBank[Suit.Hearth]
        const action = resolve(RETURN, [TENTS])
        action.apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(s.favorBank[Suit.Hearth]).toBe(before - 1)
        expect(s.pendingSearchModifiers).toBeUndefined()
        expect(action.metadata?.modifierNotes?.[0]).toMatch(/Welcoming Party/)
    })

    it('Welcoming Party: a Search resolved by discarding the keeper pays nothing', () => {
        const s = board([PARTY])
        search([modifierUse(PARTY)], [INN, TENTS]).apply(s)
        const action = new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'ruler', keptCardId: INN, discardOrder: [TENTS], play: SearchPlay.Discard })
        )
        action.apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(3)
    })

    it('Welcoming Party: its Q&A — a denizen played as a facedown adviser pays nothing', () => {
        const s = board([PARTY])
        search([modifierUse(PARTY)], [RETURN, TENTS]).apply(s)
        const before = s.favorBank[Suit.Hearth]
        new HydratedSearchResolve(
            buildAction(SearchResolve, { playerId: 'ruler', keptCardId: RETURN, discardOrder: [TENTS], play: SearchPlay.Adviser, faceUp: false })
        ).apply(s)
        expect(s.getPlayerState('ruler').favor).toBe(3)
        expect(s.favorBank[Suit.Hearth]).toBe(before)
    })

    it('Wild Cry: playing a beast card gains 1 Supply and 2 warbands; a hearth card gains nothing', () => {
        const s = board([CRY])
        search([modifierUse(CRY)], [BIRDSONG, RETURN]).apply(s)
        resolve(BIRDSONG, [RETURN]).apply(s)
        const p = s.getPlayerState('ruler')
        expect(p.supply).toBe(3 - HydratedSearch.supplyCost(s, 'ruler', SearchSource.WorldDeck) + 1)
        expect(p.warbandsOnBoard['ruler']).toBe(4)

        const t = board([CRY])
        search([modifierUse(CRY)], [BIRDSONG, RETURN]).apply(t)
        resolve(RETURN, [BIRDSONG]).apply(t)
        expect(t.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(2)
    })

    it('a Search without modifiers leaves no carry', () => {
        const s = board([CRY])
        search(undefined, [INN, TENTS]).apply(s)
        expect(s.pendingSearchModifiers).toBeUndefined()
    })
})

describe('a ruled card at another site is in reach (R-7.1.1)', () => {
    it("the Chancellor at the Mine sees A Fast Steed at Fertile Valley, where the Chancellor's warbands rule, and travels free with it", () => {
        const STEED = 'denizen.nomad.a-fast-steed'
        const s = testState(
            [testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p3', favor: 2, secrets: 1, supply: 6, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 } })],
            { chancellorPlayerId: 'chan', denizensBySite: { c1: [STEED], p3: [] }, warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 } }, siteCards: { c1: 'site.fertile-valley', p3: 'site.mine' } }
        )
        openTurn(s, 'chan')
        expect(usableModifiers(s, 'chan', ActionType.Travel).map((p) => p.cardId)).toContain(STEED)
        const use = [{ cardId: STEED, powerIndex: required(usableModifiers(s, 'chan', ActionType.Travel).find((p) => p.cardId === STEED), 'the Steed modifier').powerIndex }]
        expect(HydratedTravel.plan(s, 'chan', 'c1', use).cost).toBe(0)
        s.warbandsBySite['c1'] = {}
        expect(usableModifiers(s, 'chan', ActionType.Travel).map((p) => p.cardId)).not.toContain(STEED)
    })
})
