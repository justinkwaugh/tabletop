import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedTravel, Travel } from './travel.js'
import { HydratedTrade, TradeOption, Trade } from './trade.js'
import { HydratedSearch, SearchSource, Search } from './search.js'
import { HydratedMuster } from './muster.js'
import { HydratedRecover, RecoverTargetKind } from './recover.js'
import { Banner, PlayerStatus, Region } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { modifierUse, player, region } from '../testing/choices.js'
import { INN } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const TENTS = 'denizen.nomad.tents'
const STEED = 'denizen.nomad.a-fast-steed'
const TOLL_ROADS = 'denizen.order.toll-roads'
const CURFEW = 'denizen.order.curfew'
const FORCED_LABOR = 'denizen.order.forced-labor'
const ERRAND = 'denizen.beast.errand-boy'
const WARDEN = 'denizen.hearth.land-warden'
const MUSHROOMS = 'denizen.beast.mushrooms'
const NEWS = 'denizen.hearth.news-from-afar'
const DISGUISE = 'denizen.arcane.master-of-disguise'
const INITIATION = 'denizen.arcane.initiation-rite'
const MAGICIANS_CODE = 'denizen.arcane.magicians-code'
const STORYTELLER = 'denizen.hearth.storyteller'

const errandToProvinces = modifierUse(ERRAND, [region(Region.Provinces)])

/** `me` is on turn at c1 with the given advisers faceup; `foe` rules c1 and c2 and the cards there. */
function table(
    advisers: string[],
    me: Record<string, unknown> = {},
    state: Record<string, unknown> = {}
) {
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { me: 2 }, advisers: advisers.map((cardId) => ({ cardId, faceUp: true })), ...me }),
            testPlayer({ playerId: 'foe', color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { foe: 2 }, advisers: [{ cardId: STORYTELLER, faceUp: true }] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 1, secrets: 1, supply: 4, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } })
        ],
        {
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [INN], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { foe: 1 }, c2: { foe: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 2, provinces: 2, hinterland: 2 },
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}

const atRevision = { oathRevision: OathRevision.CostsAndFacedownModifiers }
const beforeRevision = { oathRevision: OathRevision.TurnFlow }

describe('R-7.1.2 — an action’s costs are totalled before it is accepted', () => {
    it('two declared cards that each cost a favor are refused with one favor held, naming the shortfall', () => {
        const search = table([ERRAND, WARDEN], { favor: 1 })
        expect(HydratedSearch.reasonCannotSearch(search, 'me', SearchSource.Discard, [errandToProvinces, modifierUse(WARDEN)])).toBe('costs 2 favor in all, you hold 1')
        expect(() =>
            new HydratedSearch(buildAction(Search, { playerId: 'me', drawFrom: SearchSource.Discard, revealsInfo: true, modifiers: [errandToProvinces, modifierUse(WARDEN)] })).apply(search)
        ).toThrow('Cannot search: costs 2 favor in all, you hold 1')

        const travel = table([TENTS, STEED], { favor: 1 })
        expect(HydratedTravel.reasonCannotTravel(travel, 'me', 'c2', [modifierUse(TENTS), modifierUse(STEED)])).toBe('costs 2 favor in all, you hold 1')
        travel.getPlayerState('me').favor = 2
        expect(HydratedTravel.reasonCannotTravel(travel, 'me', 'c2', [modifierUse(TENTS), modifierUse(STEED)])).toBeUndefined()
    })

    it('a costed card with a toll: Travel under Toll Roads, Search under Forced Labor', () => {
        const travel = table([TENTS], { favor: 1 }, { denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], h1: [] } })
        expect(HydratedTravel.reasonCannotTravel(travel, 'me', 'c2', [modifierUse(TENTS)], [TOLL_ROADS])).toBe('costs 2 favor in all, you hold 1')
        expect(() =>
            new HydratedTravel(buildAction(Travel, { playerId: 'me', siteId: 'c2', modifiers: [modifierUse(TENTS)], tolls: [TOLL_ROADS] })).apply(travel)
        ).toThrow('Cannot travel: costs 2 favor in all, you hold 1')
        expect(HydratedTravel.legalDestinations(travel, 'me', [modifierUse(TENTS)])).not.toContain('c2')

        const search = table([ERRAND], { favor: 1 }, { denizensBySite: { c1: [FORCED_LABOR], c2: [], p1: [], h1: [] } })
        expect(HydratedSearch.reasonCannotSearch(search, 'me', SearchSource.Discard, [errandToProvinces], [FORCED_LABOR])).toBe('costs 2 favor in all, you hold 1')
        expect(HydratedSearch.legalSources(search, 'me', [errandToProvinces])).toEqual([])
    })

    it('Trade: a toll with the two favor placed for secrets is totalled too', () => {
        const s = table([], { favor: 2 }, { denizensBySite: { c1: [CURFEW, INN], c2: [], p1: [], h1: [] } })
        expect(HydratedTrade.reasonCannotTrade(s, 'me', INN, TradeOption.ForSecrets, undefined, [CURFEW])).toBe('costs 3 favor in all, you hold 2')
        s.getPlayerState('me').favor = 3
        expect(HydratedTrade.reasonCannotTrade(s, 'me', INN, TradeOption.ForSecrets, undefined, [CURFEW])).toBeUndefined()
    })

    it('costs in different resources each total against their own holding, and pass', () => {
        const search = table([ERRAND, MUSHROOMS], { favor: 1, secrets: 1, supply: 0 })
        expect(HydratedSearch.reasonCannotSearch(search, 'me', SearchSource.Discard, [errandToProvinces, modifierUse(MUSHROOMS)])).toBeUndefined()

        const trade = table([DISGUISE], { favor: 1, secrets: 2 }, { ...atRevision, denizensBySite: { c1: [CURFEW, INN], c2: [], p1: [], h1: [] } })
        const disguised = [modifierUse(DISGUISE, [player('foe')])]
        expect(HydratedTrade.reasonCannotTrade(trade, 'me', INN, TradeOption.ForFavor, disguised, [CURFEW])).toBeUndefined()
        new HydratedTrade(buildAction(Trade, { playerId: 'me', cardId: INN, option: TradeOption.ForFavor, modifiers: disguised, tolls: [CURFEW] })).apply(trade)
        expect(trade.getPlayerState('me').secrets).toBe(0)
        expect(trade.getPlayerState('me').favor).toBeGreaterThanOrEqual(0)

        const recover = table([MAGICIANS_CODE], { favor: 2, secrets: 2 }, { banners: testBanners({}, 1) })
        expect(
            HydratedRecover.reasonCannotRecover(recover, 'me', { target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret }, amountPaid: 1, modifiers: [modifierUse(MAGICIANS_CODE)] })
        ).toBeUndefined()
    })

    it('a cost waived or redirected by a card is totalled as it is really paid', () => {
        const travel = table([TENTS], { favor: 2, supply: 0 }, { denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], h1: [] } })
        expect(HydratedTravel.reasonCannotTravel(travel, 'me', 'c2', [modifierUse(TENTS)], [TOLL_ROADS])).toBeUndefined()
        const a = new HydratedTravel(buildAction(Travel, { playerId: 'me', siteId: 'c2', modifiers: [modifierUse(TENTS)], tolls: [TOLL_ROADS] }))
        a.apply(travel)
        expect(a.metadata?.supplySpent).toBe(0)
        expect(travel.getPlayerState('me').favor).toBe(0)

        const search = table([NEWS, ERRAND], { favor: 3, supply: 0 })
        expect(HydratedSearch.reasonCannotSearch(search, 'me', SearchSource.Discard, [modifierUse(NEWS), errandToProvinces])).toBeUndefined()
        search.getPlayerState('me').favor = 2
        expect(HydratedSearch.reasonCannotSearch(search, 'me', SearchSource.Discard, [modifierUse(NEWS), errandToProvinces])).toBe('costs 3 favor in all, you hold 2')

        // Initiation Rite — "you must place a secret instead of favor".
        const muster = table([INITIATION], { favor: 0, secrets: 1 }, { denizensBySite: { c1: [INN], c2: [], p1: [], h1: [] }, warbandsBySite: { c1: { me: 1 } } })
        expect(HydratedMuster.reasonCannotMuster(muster, 'me', INN)).toBeUndefined()
    })

    it('Master of Disguise on a Trade for favor with exactly one secret: refused from this revision, accepted before it', () => {
        const disguised = [modifierUse(DISGUISE, [player('foe')])]
        const now = table([DISGUISE], { secrets: 1 }, atRevision)
        expect(HydratedTrade.reasonCannotTrade(now, 'me', INN, TradeOption.ForFavor, disguised)).toBe('costs 2 secrets in all, you hold 1')
        expect(HydratedTrade.legalCards(now, 'me', disguised)).toContain(INN)

        const old = table([DISGUISE], { secrets: 1 }, beforeRevision)
        expect(HydratedTrade.reasonCannotTrade(old, 'me', INN, TradeOption.ForFavor, disguised)).toBeUndefined()
        new HydratedTrade(buildAction(Trade, { playerId: 'me', cardId: INN, option: TradeOption.ForFavor, modifiers: disguised })).apply(old)
        expect(old.getPlayerState('me').secrets).toBe(-1)
    })

    it('R-X.4 — a Trade recorded before the revision that left secrets at minus one replays unchanged', () => {
        const disguised = [modifierUse(DISGUISE, [player('foe')])]
        const before = table([DISGUISE], { secrets: 1 }, beforeRevision).dehydrate()
        const game = testGame(['me', 'foe', 'chan'])
        const recorded = engine.runNext(buildAction(Trade, { playerId: 'me', cardId: INN, option: TradeOption.ForFavor, modifiers: disguised }), structuredClone(before), game)
        expect(recorded.updatedState.players.find((p) => p.playerId === 'me')?.secrets).toBe(-1)

        let replayed = structuredClone(before)
        for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        expect(replayed).toEqual(recorded.updatedState)
    })
})
