import { CampaignTargetKind } from '../model/campaign.js'
import { describe, expect, it } from 'vitest'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedSearch, SearchSource, Search } from '../actions/search.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedTrade, TradeOption, Trade } from '../actions/trade.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { effectiveSiteCapacity } from '../util/capacity.js'
import '../powers/index.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { actionPowerUse, facedown, modifierUse, player, battlePlanUse } from '../testing/choices.js'
import { rulerTable } from '../testing/tables.js'
import { playDrawnCard } from '../testing/steps.js'
import { INN, TENTS, FILLER } from '../testing/cards.js'

const SECOND_WIND = 'denizen.discord.second-wind'
const DREAM_THIEF = 'denizen.arcane.dream-thief'
const WITCHS_BARGAIN = 'denizen.arcane.witchs-bargain'
const MAP_LIBRARY = 'denizen.arcane.map-library'
const SMALL_FRIENDS = 'denizen.beast.small-friends'
const FAMILY_HEIRLOOM = 'denizen.hearth.family-heirloom'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const SALT = 'denizen.discord.salt-the-earth'
const WOLVES = 'denizen.beast.wolves'
const LOCKED = 'denizen.beast.vow-of-union'

const count = (n: number): PowerChoice => ({ kind: PowerChoiceKind.Count, n })

function board(cards: string[], advisers: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    return rulerTable(
        cards,
        advisers,
        {
            ...over,
            ruler: { favor: 4, ...over['ruler'] },
            other: { advisers: [{ cardId: TENTS, faceUp: false }], ...over['other'] },
            away: { advisers: [{ cardId: WOLVES, faceUp: false }], ...over['away'] }
        },
        { denizensBySite: { c1: cards, c2: [INN], p1: [WOLVES], h1: [] }, ...state }
    )
}

describe('Second Wind — a free Travel, then a free Campaign', () => {
    it('after a victory, the next Travel costs nothing and the Campaign after it does too', () => {
        const s = board([], [SECOND_WIND], { ruler: { favor: 4, secrets: 3 } }, { warbandsBySite: { c1: { other: 1 }, c2: { ruler: 2 }, p1: { other: 3 } } })
        new HydratedCampaign(buildAction(Campaign, {
            playerId: 'ruler', defender: { kind: 'player', playerId: 'other' },
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 4,
            plans: [battlePlanUse(SECOND_WIND)]
        })).apply(s)
        const me = s.getPlayerState('ruler')
        expect(me.freeTravelAtAction).toBeUndefined()
        // The battle is fixed by hand; only the plan's outcome hook is under test.
        ongoingCampaign(s).swords = 5
        ongoingCampaign(s).defense = 0
        const sac = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ruler', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
        sac.apply(s)
        const losses = defendingSideChooses(s)
        expect(sac.metadata?.attackerVictorious).toBe(true)
        expect(losses?.metadata?.planNotes ?? []).not.toContainEqual(expect.stringMatching(/Second Wind/))
        // R-5.5.8 — after R-5.5.7's spoils.
        const victory = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'ruler', placements: [], burnFavor: false }))
        victory.apply(s)
        expect(victory.metadata?.triggered?.[0]).toMatch(/Second Wind/)
        expect(me.freeTravelAtAction).toBe(s.actionCount + 1)
        expect(me.freeCampaignAtAction).toBe(s.actionCount + 1)
        s.actionCount += 1
        expect(HydratedTravel.plan(s, 'ruler', 'c2').cost).toBe(0)
        const supply = me.supply
        new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2' })).apply(s)
        expect(me.supply).toBe(supply)
        expect(me.freeTravelAtAction).toBeUndefined()
        s.actionCount += 1
        expect(HydratedCampaign.supplyCostFor(s, 'ruler')).toBe(0)
        const t = board([], [SECOND_WIND])
        t.getPlayerState('ruler').freeCampaignAtAction = t.actionCount
        expect(HydratedCampaign.supplyCostFor(t, 'ruler')).toBe(0)
    })
})

describe('Dream Thief — two facedown advisers change boards', () => {
    it('swaps across boards, refuses the same card twice, and a faceup adviser is no option', () => {
        const s = board([DREAM_THIEF], [])
        actionPowerUse('ruler', DREAM_THIEF, [facedown('other', 0), facedown('away', 0)]).apply(s)
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([WOLVES])
        expect(s.getPlayerState('away').knownAdviserIds()).toEqual([TENTS])
        // R-9.4 — each giver saw their card go, and now knows where it lies.
        expect(s.getPlayerState('other').advisers).toEqual([{ faceUp: false, shownTo: ['away'], shownCardId: WOLVES }])
        expect(s.getPlayerState('away').advisers).toEqual([{ faceUp: false, shownTo: ['other'], shownCardId: TENTS }])
        expect(HydratedUseActionPower.reasonCannotUse(board([DREAM_THIEF]), 'ruler', DREAM_THIEF, powerIndexOf(DREAM_THIEF, PowerTiming.Action), [facedown('other', 0), facedown('other', 0)])).toMatch(/chosen twice|two different/)
        expect(HydratedUseActionPower.reasonCannotUse(board([DREAM_THIEF], [INN]), 'ruler', DREAM_THIEF, powerIndexOf(DREAM_THIEF, PowerTiming.Action), [facedown('ruler', 0), facedown('other', 0)])).toMatch(/not among the options/)
    })

    it('R-X.3(c) — each holder now knows a card they had not seen, so the swap cannot be undone', () => {
        const s = board([DREAM_THIEF], [])
        const swap = actionPowerUse('ruler', DREAM_THIEF, [facedown('other', 0), facedown('away', 0)])
        swap.apply(s)
        expect(swap.metadata?.disclosed).toBe(true)
        expect(swap.revealsInfo).toBe(true)
    })
})

describe("Witch's Bargain — secrets for favor, favor for secrets, any number of times", () => {
    it('moves both ways at once and refuses what either side cannot cover', () => {
        const s = board([WITCHS_BARGAIN], [], { ruler: { favor: 4, secrets: 3 }, other: { favor: 4, secrets: 2 } })
        actionPowerUse('ruler', WITCHS_BARGAIN, [player('other'), count(1), count(1)]).apply(s)
        // The two exchanges cancel out; only the cost's secret is gone.
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 4, secrets: 2 })
        expect(s.getPlayerState('other')).toMatchObject({ favor: 4, secrets: 2 })
        expect(HydratedUseActionPower.reasonCannotUse(board([WITCHS_BARGAIN]), 'ruler', WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), [player('other'), count(0), count(0)])).toMatch(/at least one/)
        expect(HydratedUseActionPower.reasonCannotUse(board([WITCHS_BARGAIN]), 'ruler', WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), [player('other'), count(2), count(0)])).toMatch(/has 2 favor, not the 4/)
        expect(HydratedUseActionPower.reasonCannotUse(board([WITCHS_BARGAIN]), 'ruler', WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), [player('away'), count(1), count(0)])).toMatch(/not among the options/)
    })
})

describe('Map Library and Small Friends — a Trade with a card at another site', () => {
    it('Map Library reaches the region; Small Friends reaches any site with a beast card; neither without the modifier', () => {
        const s = board([MAP_LIBRARY], [])
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', INN, TradeOption.ForFavor)).toMatch(/not a denizen at your site/)
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', INN, TradeOption.ForFavor, [modifierUse(MAP_LIBRARY)])).toBeUndefined()
        // p1 is in the Provinces, out of reach of Map Library.
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', WOLVES, TradeOption.ForFavor, [modifierUse(MAP_LIBRARY)])).toMatch(/at your site/)
        expect(HydratedTrade.legalCards(s, 'ruler', [modifierUse(MAP_LIBRARY)])).toEqual([MAP_LIBRARY, INN])
        // "While your pawn is at this site" — a Map Library ruled from elsewhere does nothing.
        const away = board([], [], {}, { denizensBySite: { c1: [], c2: [MAP_LIBRARY, INN], p1: [WOLVES], h1: [] } })
        expect(HydratedTrade.reasonCannotTrade(away, 'ruler', INN, TradeOption.ForFavor, [modifierUse(MAP_LIBRARY)])).toMatch(/not at the Map Library/)
        const friends = board([], [SMALL_FRIENDS])
        expect(HydratedTrade.reasonCannotTrade(friends, 'ruler', WOLVES, TradeOption.ForFavor, [modifierUse(SMALL_FRIENDS)])).toBeUndefined()
        const t = new HydratedTrade(buildAction(Trade, { playerId: 'ruler', cardId: WOLVES, option: TradeOption.ForFavor, modifiers: [modifierUse(SMALL_FRIENDS)] }))
        t.apply(friends)
        expect(friends.cardTokens[WOLVES]).toEqual({ favor: 0, secrets: 1 })
        expect(friends.getPlayerState('ruler').siteId).toBe('c1')
    })
})

describe('Family Heirloom — a relic drawn, then asked about', () => {
    it('asks its own player; taking keeps it, refusing sends it to the bottom through the vault', () => {
        const s = board([], [])
        s.requireVault().relicDeck = ['relic.cup']
        const a = playDrawnCard(s, FAMILY_HEIRLOOM, SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toBe('Family Heirloom: drew a relic — take it, or put it on the bottom')
        expect(a.metadata?.peeked).toEqual(['relic.cup'])
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, askedPlayerId: 'ruler', relicCardId: 'relic.cup' })
        const keep = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'ruler', answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true } }))
        keep.apply(s)
        expect(s.getPlayerState('ruler').relicIds).toContain('relic.cup')
        expect(keep.revealsInfo).toBe(false)

        const t = board([], [])
        t.requireVault().relicDeck = ['relic.cup']
        playDrawnCard(t, FAMILY_HEIRLOOM, SearchPlay.Adviser)
        const bottom = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'ruler', answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: false } }))
        bottom.apply(t)
        expect(t.getPlayerState('ruler').relicIds).not.toContain('relic.cup')
        expect(bottom.metadata?.relicToDeckBottom).toBe('relic.cup')
        expect(bottom.revealsInfo).toBe(true)
        const u = board([], [])
        const b = playDrawnCard(u, FAMILY_HEIRLOOM, SearchPlay.Adviser)
        expect(b.metadata?.whenPlayed).toMatch(/no relic was drawn/)
        expect(u.pendingQuestions).toBeUndefined()
    })
})

describe('Crop Rotation — discard a denizen there first', () => {
    const cropSearch = (s: ReturnType<typeof board>) => {
        s.getPlayerState('ruler').handIds = []
        s.requireVault().worldDeck = [TENTS, FILLER]
        new HydratedSearch(buildAction(Search, { playerId: 'ruler', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(CROP_ROTATION)] })).apply(s)
    }
    const resolveWith = (discardFirstCardId?: string) =>
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: 'ruler', keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site, discardFirstCardId }))

    it('names the card at the play, seeing the one drawn, and frees a space at a full site', () => {
        const s = board([CROP_ROTATION, INN, WOLVES], [])
        s.getPlayerState('ruler').handIds = [TENTS, FILLER]
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', { keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site })).toMatch(/capacity/)
        cropSearch(s)
        expect(s.pendingSearchModifiers?.[0]).toMatchObject({ cardId: CROP_ROTATION })
        const piles = s.discardPileCounts[Region.Provinces]
        resolveWith(INN).apply(s)
        expect(s.denizensBySite['c1']).toEqual([CROP_ROTATION, WOLVES, TENTS])
        // The Inn and the filler both go to the next region's pile.
        expect(s.discardPileCounts[Region.Provinces]).toBe(piles + 2)
    })

    it('"may" — a site with room is played to with nothing discarded; a locked card is never discarded (R-7.2.2)', () => {
        const s = board([CROP_ROTATION, INN], [])
        cropSearch(s)
        resolveWith().apply(s)
        expect(s.denizensBySite['c1']).toEqual([CROP_ROTATION, INN, TENTS])
        const locked = board([CROP_ROTATION, 'denizen.beast.forest-council', WOLVES], [])
        cropSearch(locked)
        expect(HydratedSearchResolve.reasonCannotResolve(locked, 'ruler', { keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site, discardFirstCardId: 'denizen.beast.forest-council' })).toMatch(/locked/)
    })

    it('without Crop Rotation, the Great Slum or the People\'s Favor, nothing is discarded first', () => {
        const s = board([INN, WOLVES], [])
        s.getPlayerState('ruler').handIds = [TENTS, FILLER]
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', { keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site, discardFirstCardId: INN })).toMatch(/Crop Rotation/)
    })
})

describe('Salt the Earth — a site scoured to one card', () => {
    it('discards the other denizens, sets the capacity to 1, and refuses a site with a locked card', () => {
        const s = board([INN, SMALL_FRIENDS], [])
        playDrawnCard(s, SALT, SearchPlay.Site)
        expect(s.denizensBySite['c1']).toEqual([SALT])
        expect(effectiveSiteCapacity(s, 'c1')).toBe(1)
        s.getPlayerState('ruler').handIds = [TENTS, FILLER]
        expect(HydratedSearchResolve.reasonCannotResolve(s, 'ruler', { keptCardId: TENTS, discardOrder: [FILLER], play: SearchPlay.Site })).toMatch(/capacity of 1/)
        const full = board([INN, SMALL_FRIENDS, CROP_ROTATION], [])
        playDrawnCard(full, SALT, SearchPlay.Site)
        expect(full.denizensBySite['c1']).toEqual([SALT])
        const locked = board([LOCKED], [])
        locked.getPlayerState('ruler').handIds = [SALT, FILLER]
        expect(HydratedSearchResolve.reasonCannotResolve(locked, 'ruler', { keptCardId: SALT, discardOrder: [FILLER], play: SearchPlay.Site })).toMatch(/locked/)
    })
})
