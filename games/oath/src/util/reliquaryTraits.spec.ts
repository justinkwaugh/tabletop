import { describe, expect, it } from 'vitest'
import { Color, range } from '@tabletop/common'
import type { OathPlayerState } from '../model/playerState.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { ActionType } from '../definition/actions.js'
import { IMPERIAL_COLOR, PlayerStatus, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { reliquarySlotId } from '../model/setup.js'
import { RELIQUARY_MODIFIERS } from '../data/reliquary.js'
import { forceTotal } from './force.js'
import { mandatoryModifiers } from './modifiers.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { BRUTAL, CARELESS, DECADENT, GREEDY, hasTrait, uncoveredTraits } from './reliquaryTraits.js'
import '../powers/index.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { INN } from '../testing/cards.js'

const RETURN = 'denizen.hearth.awaited-return'

function reliquary(uncovered: number[] = []) {
    return range(0, 4)
        .filter((i) => !uncovered.includes(i))
        .map((i) => ({ slotId: reliquarySlotId(i) }))
}

const SPACE: Record<string, number> = { [BRUTAL]: 0, [DECADENT]: 1, [CARELESS]: 2, [GREEDY]: 3 }

function board(
    uncovered: string[],
    over: Record<string, unknown> = {},
    ruler: Partial<OathPlayerState> = {},
    cards: string[] = [INN],
    advisers: string[] = []
) {
    const siteId = ruler.siteId ?? 'c1'
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId,
                favor: 3,
                secrets: 2,
                supply: 3,
                warbandsOnBoard: { [IMPERIAL_COLOR]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 10 },
                advisers: advisers.map((cardId) => ({ cardId, faceUp: true })),
                ...ruler
            }),
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                siteId: 'p1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { [Color.Blue]: 4 },
                warbandsInPersonalBank: { [Color.Blue]: 5 }
            })
        ],
        {
            chancellorPlayerId: 'ruler',
            reliquary: reliquary(uncovered.map((id) => required(SPACE[id], `space ${id}`))),
            denizensBySite: { [siteId]: cards },
            warbandsBySite: { c1: { [Color.Blue]: 1 }, p1: { [Color.Blue]: 3 } },
            discardPileCounts: { cradle: 3, provinces: 3, hinterland: 3 },
            ...over
        }
    )
    openTurn(s, 'ruler')
    return s
}

describe('which traits are in force (R-6.6.2.a)', () => {
    it('none while every space is covered; each uncovered space adds its trait, in placard order', () => {
        expect(uncoveredTraits(board([]), 'ruler')).toEqual([])
        expect(uncoveredTraits(board([GREEDY]), 'ruler').map((t) => t.id)).toEqual([GREEDY])
        expect(uncoveredTraits(board([GREEDY, BRUTAL]), 'ruler').map((t) => t.id)).toEqual([BRUTAL, GREEDY])
        expect(uncoveredTraits(board([BRUTAL, DECADENT, CARELESS, GREEDY]), 'ruler')).toEqual(RELIQUARY_MODIFIERS)
    })

    it('only the Chancellor has them — an Exile beside an empty Reliquary gains nothing', () => {
        const s = board([BRUTAL, DECADENT, CARELESS, GREEDY])
        expect(uncoveredTraits(s, 'other')).toEqual([])
        expect(hasTrait(s, 'other', BRUTAL)).toBe(false)
        expect(hasTrait(s, 'ruler', BRUTAL)).toBe(true)
    })

    it('rides the modifier framework as a mandatory modifier of the action it names', () => {
        const s = board([DECADENT, CARELESS, GREEDY])
        expect(mandatoryModifiers(s, 'ruler', ActionType.Travel).map((m) => m.power.cardId)).toEqual([DECADENT])
        expect(mandatoryModifiers(s, 'ruler', ActionType.Trade).map((m) => m.power.cardId)).toEqual([CARELESS])
        expect(mandatoryModifiers(s, 'ruler', ActionType.Search).map((m) => m.power.cardId)).toEqual([GREEDY])
        expect(mandatoryModifiers(s, 'ruler', ActionType.Muster)).toEqual([])
        expect(mandatoryModifiers(s, 'ruler', ActionType.Travel)[0]?.mandatory).toBe(true)
    })
})

describe('Decadent — Travel (R-6.6.2.a)', () => {
    const cost = (s: ReturnType<typeof board>, to: string) => HydratedTravel.plan(s, 'ruler', to).cost

    it('to the Cradle from the Provinces or Hinterland costs nothing', () => {
        expect(cost(board([], {}, { siteId: 'p1' }), 'c1')).toBeGreaterThan(0)
        expect(cost(board([DECADENT], {}, { siteId: 'p1' }), 'c1')).toBe(0)
        expect(cost(board([DECADENT], {}, { siteId: 'h1' }), 'c2')).toBe(0)
        expect(cost(board([DECADENT]), 'c2')).toBe(cost(board([]), 'c2'))
    })

    it('to the Hinterland costs one more', () => {
        expect(cost(board([DECADENT]), 'h1')).toBe(cost(board([]), 'h1') + 1)
        expect(cost(board([DECADENT], {}, { siteId: 'h1' }), 'h2')).toBe(
            cost(board([], {}, { siteId: 'h1' }), 'h2') + 1
        )
        expect(cost(board([DECADENT], {}, { siteId: 'p1' }), 'p2')).toBe(cost(board([], {}, { siteId: 'p1' }), 'p2'))
    })

    it('the Travel itself spends the folded cost', () => {
        const s = board([DECADENT], {}, { siteId: 'p1', supply: 3 })
        new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c1' })).apply(s)
        expect(s.getPlayerState('ruler').supply).toBe(3)
        expect(s.getPlayerState('ruler').siteId).toBe('c1')
    })
})

describe('Careless — Trade (R-6.6.2.a)', () => {
    function trade(s: ReturnType<typeof board>, option: TradeOption) {
        const action = new HydratedTrade(
            buildAction(Trade, { playerId: 'ruler', cardId: INN, option })
        )
        action.apply(s)
        return action
    }

    it('one more favor when trading for favor', () => {
        const plain = trade(board([]), TradeOption.ForFavor)
        const careless = trade(board([CARELESS]), TradeOption.ForFavor)
        expect(careless.metadata?.favorGained).toBe((plain.metadata?.favorGained ?? 0) + 1)
    })

    it('trading for secrets: one less secret, and still one favor from the card\'s bank', () => {
        const plain = board([], {}, {}, [INN], [RETURN])
        const careless = board([CARELESS], {}, {}, [INN], [RETURN])
        const plainTrade = trade(plain, TradeOption.ForSecrets)
        const carelessTrade = trade(careless, TradeOption.ForSecrets)
        expect(plainTrade.metadata?.secretsGained).toBe(1)
        expect(carelessTrade.metadata?.secretsGained).toBe(0)
        expect(plain.getPlayerState('ruler').favor).toBe(1)
        expect(careless.getPlayerState('ruler').favor).toBe(2)
        expect(careless.favorBank[Suit.Hearth]).toBe(plain.favorBank[Suit.Hearth] - 1)
        expect(carelessTrade.metadata?.modifierNotes).toEqual(['Careless: gained 1 favor'])
    })

    it('an empty bank gives nothing (R-9.3), and says so', () => {
        const s = board([CARELESS], { favorBank: { ...board([]).favorBank, [Suit.Hearth]: 0 } })
        const action = trade(s, TradeOption.ForSecrets)
        expect(s.getPlayerState('ruler').favor).toBe(1)
        expect(action.metadata?.modifierNotes).toEqual(['Careless: the bank had no favor to give'])
    })
})

describe('Greedy — Search (R-6.6.2.a)', () => {
    it('draws two more, without being declared', () => {
        expect(HydratedSearch.drawCount(board([]), 'ruler')).toBe(3)
        expect(HydratedSearch.drawCount(board([GREEDY]), 'ruler')).toBe(5)
    })

    it('cannot search when it would spend more than 2 Supply', () => {
        const cheap = board([GREEDY], { visionsDrawn: 0 }, { supply: 5 })
        const dear = board([GREEDY], { visionsDrawn: 1 }, { supply: 5 })
        expect(HydratedSearch.reasonCannotSearch(cheap, 'ruler', SearchSource.WorldDeck)).toBeUndefined()
        expect(HydratedSearch.reasonCannotSearch(dear, 'ruler', SearchSource.WorldDeck)).toMatch(/Greedy.*3 Supply/)
        expect(HydratedSearch.reasonCannotSearch(dear, 'ruler', SearchSource.Discard)).toBeUndefined()
        expect(
            HydratedSearch.reasonCannotSearch(board([], { visionsDrawn: 1 }, { supply: 5 }), 'ruler', SearchSource.WorldDeck)
        ).toBeUndefined()
        expect(() =>
            new HydratedSearch(
                buildAction(Search, {
                    playerId: 'ruler',
                    drawFrom: SearchSource.WorldDeck,
                    revealsInfo: true
                })
            ).apply(dear)
        ).toThrow(/Greedy/)
    })
})

describe('Brutal — Campaign (R-6.6.2.a)', () => {
    function battle(uncovered: string[], seed = 1) {
        const s = board(uncovered, { prng: { seed, invocations: 0 } }, { supply: 5 })
        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: 'ruler',
                defender: { kind: 'player', playerId: 'other' },
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackDice: 3,
            })
        ).apply(s)
        const campaign = ongoingCampaign(s)
        const attackerWon = campaign.swords > campaign.defense
        const defeatedTotal = attackerWon
            ? forceTotal(campaign.defendingForce)
            : Object.values(s.getPlayerState('ruler').warbandsOnBoard).reduce((a, b) => a + b, 0)
        return { s, attackerWon, defeatedTotal }
    }

    it('the defeated force dies whole, whichever side lost, when the Chancellor attacks', () => {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const plain = battle([], seed)
            const brutal = battle([BRUTAL], seed)
            expect(brutal.attackerWon).toBe(plain.attackerWon)
            expect(forceTotal(HydratedCampaignSacrifice.defaultDefeatKills(plain.s, 0))).toBe(
                Math.floor(plain.defeatedTotal / 2)
            )
            expect(forceTotal(HydratedCampaignSacrifice.defaultDefeatKills(brutal.s, 0))).toBe(brutal.defeatedTotal)
        }
    })

    it('under Brutal a defeated defending force dies whole, so its side is left no pick', () => {
        const { s, attackerWon, defeatedTotal } = battle([BRUTAL], 2)
        expect(attackerWon).toBe(true)
        expect(HydratedCampaignSacrifice.lossChooser(s, ongoingCampaign(s))).toBeUndefined()
        const sacrifice = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ruler', sacrifice: 0 }))
        sacrifice.apply(s)
        expect(s.campaign?.pendingDefeatKills).toBeUndefined()
        expect(sacrifice.metadata?.defeatKilled).toBe(defeatedTotal)
    })

    it('does nothing when the Chancellor is the defender', () => {
        const s = board([BRUTAL], { prng: { seed: 1, invocations: 0 } })
        openTurn(s, 'other')
        const other = s.getPlayerState('other')
        other.supply = 5
        other.siteId = 'c1'
        s.warbandsBySite = { c1: { [IMPERIAL_COLOR]: 2 }, p1: { [Color.Blue]: 3 } }
        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: 'other',
                defender: { kind: 'player', playerId: 'ruler' },
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackDice: 3,
            })
        ).apply(s)
        const campaign = ongoingCampaign(s)
        const defeatedTotal =
            campaign.swords > campaign.defense
                ? forceTotal(campaign.defendingForce)
                : Object.values(other.warbandsOnBoard).reduce((a, b) => a + b, 0)
        expect(forceTotal(HydratedCampaignSacrifice.defaultDefeatKills(s, 0))).toBe(Math.floor(defeatedTotal / 2))
    })
})
