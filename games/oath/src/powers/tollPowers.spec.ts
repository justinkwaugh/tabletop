import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedSearch, SearchSource } from '../actions/search.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { tollsFor } from '../util/tolls.js'
import { defaultTolls } from '../util/tollDefaults.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { INN } from '../testing/cards.js'

const TOLL_ROADS = 'denizen.order.toll-roads'
const CURFEW = 'denizen.order.curfew'
const FORCED_LABOR = 'denizen.order.forced-labor'
const WAY_STATION = 'denizen.nomad.way-station'

/** `foe` is on turn; red rules c1 and c2, blue rules p1. */
function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, siteId: 'c1', favor: 3, secrets: 3, supply: 4, warbandsOnBoard: { [Color.Red]: 2 }, ...over['ruler'] }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 }, ...over['foe'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 1, secrets: 1, supply: 4, ...over['chan'] })
        ],
        {
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [INN], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [Color.Red]: 1 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, 'foe')
    return s
}

function travel(s: ReturnType<typeof board>, playerId: string, siteId: string, tolls?: string[]) {
    const a = new HydratedTravel(buildAction(Travel, { playerId, siteId, tolls }))
    a.apply(s)
    return a
}

describe('Toll Roads — a favor to travel into the ruler’s sites', () => {
    it("demands a favor of the ruler's enemies, refused without it, paid with it", () => {
        const s = board({}, { denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], h1: [] } })
        expect(tollsFor(s, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([{ cardId: TOLL_ROADS, payeeId: 'ruler' }])
        expect(HydratedTravel.reasonCannotTravel(s, 'foe', 'c2')).toMatch(/unless you give a favor to its ruler/)
        expect(HydratedTravel.reasonCannotTravel(s, 'foe', 'c2', undefined, [TOLL_ROADS])).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(s, 'foe', 'p1')).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(s, 'foe', 'p1', undefined, [TOLL_ROADS])).toMatch(/demands no toll/)
        const a = travel(s, 'foe', 'c2', [TOLL_ROADS])
        expect(s.getPlayerState('foe').favor).toBe(2)
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(s.getPlayerState('foe').siteId).toBe('c2')
        expect(a.metadata?.tollsPaid).toEqual([`${TOLL_ROADS}: gave a favor to ruler`])
        expect(a.metadata?.supplySpent).toBe(1)
    })

    it('the ruler and their friends pay nothing; a broke enemy is refused; the default tolls make the site legal', () => {
        const s = board({ foe: { favor: 0 } }, { denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], h1: [] } })
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'c2')).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(s, 'foe', 'c2', undefined, [TOLL_ROADS])).toMatch(/take 1 favor and you have 0/)
        expect(HydratedTravel.legalDestinations(s, 'foe')).not.toContain('c2')
        s.getPlayerState('foe').favor = 1
        expect(HydratedTravel.legalDestinations(s, 'foe')).toContain('c2')
        expect(defaultTolls(s, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([TOLL_ROADS])
    })

    it('an Imperial ruler is paid through the Chancellor; a bandit-ruled card burns the favor', () => {
        const imperial = board(
            { ruler: { status: PlayerStatus.Citizen, color: Color.Purple } },
            { denizensBySite: { c1: [], c2: [TOLL_ROADS], p1: [], h1: [] }, warbandsBySite: { c1: { purple: 1 }, c2: { purple: 2 }, p1: { [Color.Blue]: 3 } } }
        )
        expect(tollsFor(imperial, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([{ cardId: TOLL_ROADS, payeeId: 'chan' }])
        travel(imperial, 'foe', 'c2', [TOLL_ROADS])
        expect(imperial.getPlayerState('chan').favor).toBe(2)
        const bandits = board({}, { denizensBySite: { c1: [], c2: [TOLL_ROADS], p1: [], h1: [] }, warbandsBySite: { c1: { [Color.Red]: 1 }, p1: { [Color.Blue]: 3 } } })
        expect(tollsFor(bandits, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([{ cardId: TOLL_ROADS, payeeId: undefined }])
        const supply = bandits.favorSupply
        const a = travel(bandits, 'foe', 'c2', [TOLL_ROADS])
        expect(bandits.favorSupply).toBe(supply + 1)
        expect(a.metadata?.tollsPaid?.[0]).toMatch(/burned/)
    })
})

describe('Way Station — a free Travel for a favor, or for ruling it', () => {
    it('offers, never demands: Supply is spent unless the toll is listed, and the ruler travels free', () => {
        const s = board({}, { denizensBySite: { c1: [], c2: [WAY_STATION], p1: [], h1: [] } })
        expect(tollsFor(s, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([{ cardId: WAY_STATION, payeeId: 'ruler', discount: true }])
        expect(HydratedTravel.plan(s, 'foe', 'c2').cost).toBe(1)
        expect(HydratedTravel.plan(s, 'foe', 'c2', undefined, [WAY_STATION]).cost).toBe(0)
        expect(HydratedTravel.plan(s, 'ruler', 'c2').cost).toBe(0)
        const a = travel(s, 'foe', 'c2', [WAY_STATION])
        expect(a.metadata?.supplySpent).toBe(0)
        expect(s.getPlayerState('foe').favor).toBe(2)
        expect(s.getPlayerState('ruler').favor).toBe(4)
    })

    it('R-X.1 — the favor is the player\'s choice whatever their Supply, and the only legal term when it runs short', () => {
        const s = board({ foe: { supply: 0 } }, { denizensBySite: { c1: [], c2: [WAY_STATION], p1: [], h1: [] } })
        expect(defaultTolls(s, 'foe', { kind: 'travel', toSiteId: 'c2' })).toEqual([])
        expect(HydratedTravel.legalTerms(s, 'foe', 'c2')).toEqual([{ tolls: [WAY_STATION], flipSecret: false }])
        expect(HydratedTravel.legalDestinations(s, 'foe')).toEqual(['c2'])
        s.getPlayerState('foe').supply = 2
        expect(HydratedTravel.legalTerms(s, 'foe', 'c2')).toEqual([
            { tolls: [], flipSecret: false },
            { tolls: [WAY_STATION], flipSecret: false }
        ])
    })
})

describe('Curfew and Forced Labor — a favor to trade or search under the ruler', () => {
    it('Curfew tolls an enemy trading with a card the ruler rules, and leaves enough favor to place', () => {
        const s = board({}, { denizensBySite: { c1: [CURFEW, INN], c2: [], p1: [], h1: [] } })
        expect(HydratedTrade.reasonCannotTrade(s, 'foe', INN, TradeOption.ForFavor)).toMatch(/unless you give a favor/)
        expect(HydratedTrade.reasonCannotTrade(s, 'foe', INN, TradeOption.ForFavor, undefined, [CURFEW])).toBeUndefined()
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', INN, TradeOption.ForFavor)).toBeUndefined()
        // Two favor to place after a one-favor toll needs three.
        const poor = board({ foe: { favor: 2 } }, { denizensBySite: { c1: [CURFEW, INN], c2: [], p1: [], h1: [] } })
        expect(HydratedTrade.reasonCannotTrade(poor, 'foe', INN, TradeOption.ForSecrets, undefined, [CURFEW])).toMatch(/not enough favor is left/)
        const a = new HydratedTrade(buildAction(Trade, { playerId: 'foe', cardId: INN, option: TradeOption.ForFavor, tolls: [CURFEW] }))
        a.apply(s)
        expect(a.metadata?.tollsPaid).toEqual([`${CURFEW}: gave a favor to ruler`])
        expect(s.getPlayerState('ruler').favor).toBe(4)
        expect(HydratedTrade.canDoTrade(board({}, { denizensBySite: { c1: [CURFEW, INN], c2: [], p1: [], h1: [] } }), 'foe')).toBe(true)
    })

    it('Forced Labor tolls an enemy searching from a ruled site', () => {
        const s = board({}, { denizensBySite: { c1: [FORCED_LABOR], c2: [], p1: [], h1: [] } })
        expect(HydratedSearch.reasonCannotSearch(s, 'foe', SearchSource.WorldDeck)).toMatch(/cannot search from here unless/)
        expect(HydratedSearch.reasonCannotSearch(s, 'foe', SearchSource.WorldDeck, undefined, [FORCED_LABOR])).toBeUndefined()
        expect(HydratedSearch.legalSources(s, 'foe')).toContain(SearchSource.WorldDeck)
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.WorldDeck)).toBeUndefined()
        s.getPlayerState('foe').siteId = 'p1'
        expect(HydratedSearch.reasonCannotSearch(s, 'foe', SearchSource.WorldDeck)).toBeUndefined()
    })
})
