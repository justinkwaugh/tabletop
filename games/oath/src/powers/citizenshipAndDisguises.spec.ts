import { describe, expect, it } from 'vitest'
import { machineContext, buildAction, defendingSideChooses } from '../testing/actions.js'
import { Color } from '@tabletop/common'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { MachineState } from '../definition/states.js'
import { SearchingStateHandler } from '../stateHandlers/searching.js'
import { CampaignVictoryStateHandler } from '../stateHandlers/campaigning.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { MAX_SUPPLY } from '../util/rest.js'
import '../powers/index.js'
import { type ModifierUse } from '../util/modifiers.js'
import { ongoingCampaign } from '../testing/required.js'
import { bank, modifierUse, player, region, yes } from '../testing/choices.js'
import { playDrawnCard } from '../testing/steps.js'
import { FILLER, INN } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

const HOSPITALITY = 'denizen.nomad.hospitality'
const DISGUISE = 'denizen.arcane.master-of-disguise'
const TROUPE = 'denizen.arcane.acting-troupe'
const ERRAND = 'denizen.beast.errand-boy'
const OBSERVATORY = 'denizen.arcane.observatory'
const BALLOT = 'denizen.hearth.ballot-box'
const HEIR = 'denizen.beast.long-lost-heir'
const BEWITCH = 'denizen.arcane.bewitch'
const MARTIAL = 'denizen.order.martial-culture'
const STORYTELLER = 'denizen.hearth.storyteller'
const WOLVES = 'denizen.beast.wolves'


function board(cards: Record<string, string[]> = {}, advisers: Record<string, string[]> = {}, over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const adv = (id: string) => (advisers[id] ?? []).map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 3, supply: 5, warbandsOnBoard: { ruler: 4 }, warbandsInPersonalBank: { ruler: 6 }, advisers: adv('ruler'), ...over['ruler'] }),
            testPlayer({ playerId: 'other', color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 2, supply: 5, warbandsOnBoard: { other: 3 }, warbandsInPersonalBank: { other: 5 }, advisers: adv('other'), ...over['other'] }),
            testPlayer({ playerId: 'chancellor', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 2, secrets: 2, supply: 5, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 }, advisers: adv('chancellor'), ...over['chancellor'] })
        ],
        {
            chancellorPlayerId: 'chancellor',
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...cards },
            warbandsBySite: { c1: { ruler: 1 }, c2: { other: 2 }, p1: {}, h1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 0, provinces: 3, hinterland: 2 },
            prng: { seed: 1, invocations: 0 },
            ...state
        }
    )
    openTurn(s, 'ruler')
    return s
}
describe('choices on declared modifiers', () => {
    it('Hospitality — a favor from a bank matching both a card at the destination and an adviser', () => {
        const s = board({ c2: [WOLVES] }, { ruler: [HOSPITALITY, WOLVES] })
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'c2', [modifierUse(HOSPITALITY, [bank(Suit.Beast)])])).toBeUndefined()
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'c2', [modifierUse(HOSPITALITY, [bank(Suit.Hearth)])])).toMatch(/no hearth card at c2/)
        expect(HydratedTravel.reasonCannotTravel(s, 'ruler', 'c2', [modifierUse(HOSPITALITY)])).toBeTruthy()
        const beast = s.favorBank[Suit.Beast]
        const a = new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2', modifiers: [modifierUse(HOSPITALITY, [bank(Suit.Beast)])] }))
        a.apply(s)
        expect(s.favorBank[Suit.Beast]).toBe(beast - 1)
        expect(s.getPlayerState('ruler').favor).toBe(5)
        expect(a.metadata?.modifierNotes).toEqual(['Hospitality: gained 1 favor from the beast bank'])
        const noAdviser = board({ c2: [WOLVES] }, { ruler: [HOSPITALITY] })
        expect(HydratedTravel.reasonCannotTravel(noAdviser, 'ruler', 'c2', [modifierUse(HOSPITALITY, [bank(Suit.Beast)])])).toMatch(/no beast adviser/)
    })

    it("Master of Disguise — trade with another player's advisers; Acting Troupe — the Troupe as beast or order", () => {
        const s = board({ c1: [INN] }, { ruler: [DISGUISE], other: [STORYTELLER, 'denizen.hearth.salad-days'] })
        const plain = board({ c1: [INN] }, { ruler: [DISGUISE], other: [STORYTELLER, 'denizen.hearth.salad-days'] })
        new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId: INN, option: TradeOption.ForFavor })).apply(plain)
        const a = new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId: INN, option: TradeOption.ForFavor, modifiers: [modifierUse(DISGUISE, [player('other')])] }))
        a.apply(s)
        expect(a.metadata?.matchingAdvisers).toBe(2)
        expect(a.metadata?.favorGained).toBe((plain.getPlayerState('ruler').favor - 4) + 2)
        expect(s.getPlayerState('ruler').secrets).toBe(3 - 1 - 1)

        // Its Q&A — the advisers are fully replaced: your own restrictions and modifiers go, theirs come.
        const POVERTY = 'denizen.beast.vow-of-poverty'
        const SIGNAL = 'denizen.arcane.secret-signal'
        const vowed = board({ c1: [INN] }, { ruler: [DISGUISE, POVERTY, TROUPE], other: [STORYTELLER, SIGNAL] })
        const disguised = (more: ModifierUse[] = []) => [modifierUse(DISGUISE, [player('other')]), ...more]
        expect(HydratedTrade.reasonCannotTrade(vowed, 'ruler', INN, TradeOption.ForFavor)).toMatch(/Vow of Poverty/)
        expect(HydratedTrade.reasonCannotTrade(vowed, 'ruler', INN, TradeOption.ForFavor, disguised())).toBeUndefined()
        expect(HydratedTrade.reasonCannotTrade(vowed, 'ruler', INN, TradeOption.ForFavor, disguised([modifierUse(TROUPE, [bank(Suit.Beast)])]))).toMatch(/can't use your other advisers/)
        expect(HydratedTrade.reasonCannotTrade(vowed, 'ruler', INN, TradeOption.ForSecrets, [modifierUse(SIGNAL)])).toMatch(/neither rule/)
        expect(HydratedTrade.reasonCannotTrade(vowed, 'ruler', INN, TradeOption.ForFavor, disguised([modifierUse(SIGNAL)]))).toBeUndefined()

        const t = board({ c1: [WOLVES] }, { ruler: [TROUPE] })
        expect(HydratedTrade.matchingAdvisers(t, 'ruler', WOLVES)).toBe(0)
        const b = new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId: WOLVES, option: TradeOption.ForFavor, modifiers: [modifierUse(TROUPE, [bank(Suit.Beast)])] }))
        b.apply(t)
        expect(b.metadata?.matchingAdvisers).toBe(1)
        expect(() => new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId: WOLVES, option: TradeOption.ForFavor, modifiers: [modifierUse(TROUPE, [bank(Suit.Hearth)])] })).apply(board({ c1: [WOLVES] }, { ruler: [TROUPE] }))).toThrow()
    })

    it("Errand Boy and Observatory — a Search from another region's discard pile", () => {
        const s = board({}, { ruler: [ERRAND] })
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.Discard)).toMatch(/cradle discard pile is empty/)
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.Discard, [modifierUse(ERRAND, [region(Region.Provinces)])])).toBeUndefined()
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.Discard, [modifierUse(ERRAND, [region(Region.Cradle)])])).toBeTruthy()
        expect(HydratedSearch.reasonCannotSearch(s, 'ruler', SearchSource.WorldDeck, [modifierUse(ERRAND, [region(Region.Provinces)])])).toMatch(/not searching a discard pile/)
        expect(HydratedSearch.drawRegion(s, 'ruler', [modifierUse(ERRAND, [region(Region.Hinterland)])])).toBe(Region.Hinterland)
        s.requireVault().discardPiles[Region.Provinces] = [INN, FILLER]
        new HydratedSearch(buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.Discard, revealsInfo: true, modifiers: [modifierUse(ERRAND, [region(Region.Provinces)])] })).apply(s)
        expect(s.discardPileCounts.provinces).toBe(1)
        expect(s.tokensOn(ERRAND).favor).toBe(1)

        const o = board({ c1: [OBSERVATORY] })
        expect(HydratedSearch.drawRegion(o, 'ruler', [modifierUse(OBSERVATORY, [region(Region.Hinterland)])])).toBe(Region.Hinterland)
        const away = board({ c2: [OBSERVATORY] })
        // R-7.1.1 — a card at a site the ruler neither stands on nor rules is out of reach.
        expect(HydratedSearch.reasonCannotSearch(away, 'ruler', SearchSource.Discard, [modifierUse(OBSERVATORY, [region(Region.Hinterland)])])).toBeTruthy()
        // Ruling c2 puts the card in reach; the Observatory still needs the pawn at its site.
        const ruledAfar = board({ c2: [OBSERVATORY] }, {}, {}, { warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 }, p1: {}, h1: { [IMPERIAL_WARBANDS]: 2 } } })
        expect(HydratedSearch.reasonCannotSearch(ruledAfar, 'ruler', SearchSource.Discard, [modifierUse(OBSERVATORY, [region(Region.Hinterland)])])).toMatch(/not at the Observatory/)
    })
})

describe('Citizenship routes', () => {
    it("Ballot Box — an Exile with the People's Favor becomes a Citizen, Supply full, Act Phase over", () => {
        const pf = { banners: { [Banner.PeoplesFavor]: { holderPlayerId: 'ruler', value: 1 }, [Banner.DarkestSecret]: { value: 1 } } }
        const s = board({ c1: [BALLOT] }, {}, { ruler: { supply: 1 } }, pf)
        const a = new HydratedUseActionPower(buildAction(UseActionPower, { playerId: 'ruler', cardId: BALLOT, powerIndex: 0 }))
        a.apply(s)
        expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
        expect(s.getPlayerState('ruler').supply).toBe(MAX_SUPPLY)
        expect(s.getPlayerState('ruler').warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(4)
        expect(a.metadata?.endsActPhase).toBe(true)
        expect(() => new HydratedUseActionPower(buildAction(UseActionPower, { playerId: 'ruler', cardId: BALLOT, powerIndex: 0 })).apply(board({ c1: [BALLOT] }))).toThrow(/People's Favor/)
    })

    it('Long-Lost Heir and Bewitch — a "may" on the play, and the play ends the Act Phase', () => {
        const s = board()
        const a = playDrawnCard(s, HEIR, SearchPlay.Adviser, [yes])
        expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
        expect(a.metadata?.endsActPhase).toBe(true)
        expect(new SearchingStateHandler().onAction(a, machineContext(s))).toBe(MachineState.RestPhase)
        const keep = board()
        const b = playDrawnCard(keep, HEIR, SearchPlay.Adviser)
        expect(keep.getPlayerState('ruler').status).toBe(PlayerStatus.Exile)
        expect(new SearchingStateHandler().onAction(b, machineContext(keep))).toBe(MachineState.ActPhase)

        // Bewitch: 3 secrets against the Chancellor's 2 — yes; against 4, no.
        const w = board()
        playDrawnCard(w, BEWITCH, SearchPlay.Site, [yes])
        expect(w.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
        expect(() => playDrawnCard(board({}, {}, { chancellor: { secrets: 4 } }), BEWITCH, SearchPlay.Site, [yes])).toThrow(/not more than the Chancellor/)
    })

    it('Martial Culture — an Exile who defeats another Exile with it becomes a Citizen, and the phase ends after the spoils', () => {
        for (let seed = 1; seed < 40; seed++) {
            const s = board({}, { ruler: [MARTIAL] }, {}, { prng: { seed, invocations: 0 } })
            new HydratedCampaign(buildAction(Campaign, { playerId: 'ruler', defender: { kind: 'player', playerId: 'other' }, targets: [{ kind: CampaignTargetKind.PawnAndFavor }], attackDice: 4, plans: [{ cardId: MARTIAL, powerIndex: powerIndexOf(MARTIAL, PowerTiming.BattlePlan) }] })).apply(s)
            if (!(ongoingCampaign(s).swords > ongoingCampaign(s).defense)) continue
            const sac = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ruler', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
            sac.apply(s)
            defendingSideChooses(s)
            // R-5.5.8 — "if you're victorious" waits for R-5.5.7's spoils.
            expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Exile)
            const v = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'ruler', placements: [], burnFavor: false }))
            v.apply(s)
            expect(s.getPlayerState('ruler').status).toBe(PlayerStatus.Citizen)
            expect(v.metadata?.endsActPhase).toBe(true)
            expect(new CampaignVictoryStateHandler().onAction(v, machineContext(s))).toBe(MachineState.RestPhase)
            return
        }
        throw new Error('no seed gave a victory')
    })
})
