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
import { actionPowerUse, bargain, facedown, modifierUse, player, battlePlanUse } from '../testing/choices.js'
import { OathRevision } from '../util/revision.js'
import { witchsBargainBounds, type BargainEntry } from '../util/witchsBargain.js'
import { rulerTable } from '../testing/tables.js'
import { playDrawnCard } from '../testing/steps.js'
import { INN, TENTS, FILLER } from '../testing/cards.js'
import { served, spectator } from '../testing/projection.js'
import type { Visibility } from '@tabletop/common'
import { discardInListedOrder } from '../testing/steps.js'

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

describe('Second Wind — from revision 27 its free Travel and Campaign name it', () => {
    it('in its own turn, the Travel and the Campaign after it each record Second Wind', () => {
        const s = board([], [SECOND_WIND], { ruler: { favor: 4, secrets: 3 }, other: { siteId: 'c2' } }, { oathRevision: OathRevision.EngineFixes23, warbandsBySite: { c1: { other: 1 }, c2: { ruler: 2 }, p1: { other: 3 } } })
        new HydratedCampaign(buildAction(Campaign, {
            playerId: 'ruler', defender: { kind: 'player', playerId: 'other' },
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 4,
            plans: [battlePlanUse(SECOND_WIND)]
        })).apply(s)
        ongoingCampaign(s).swords = 5
        ongoingCampaign(s).defense = 0
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'ruler', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
        defendingSideChooses(s)
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'ruler', placements: [], burnFavor: false })).apply(s)
        const me = s.getPlayerState('ruler')
        expect(me).toMatchObject({ freeTravelGrantedBy: SECOND_WIND, freeCampaignGrantedBy: SECOND_WIND })
        s.actionCount += 1
        const travel = new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2' }))
        travel.apply(s)
        expect(travel.metadata).toMatchObject({ supplySpent: 0, freeActionOf: SECOND_WIND })
        expect(me.freeTravelGrantedBy).toBeUndefined()
        expect(me.freeCampaignGrantedBy).toBe(SECOND_WIND)
        s.actionCount += 1
        const campaign = new HydratedCampaign(buildAction(Campaign, {
            playerId: 'ruler', defender: { kind: 'player', playerId: 'other' },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }], attackDice: 2
        }))
        campaign.apply(s)
        expect(campaign.metadata).toMatchObject({ supplySpent: 0, freeActionOf: SECOND_WIND })
        expect(me.freeCampaignGrantedBy).toBeUndefined()
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
        // R-9.4 — each giver is served where their card went; the thief and a spectator neither card.
        const rowsSeenBy = (perspective: Visibility.Perspective) => {
            const view = served(s, perspective)
            return ['other', 'away'].map((id) => view.players.find((p) => p.playerId === id)?.advisers)
        }
        expect(rowsSeenBy({ kind: 'player', playerId: 'away' })).toEqual([[{ faceUp: false, shownTo: ['away'], shownCardId: WOLVES }], [{ faceUp: false, shownTo: ['other'] }]])
        expect(rowsSeenBy({ kind: 'player', playerId: 'other' })).toEqual([[{ faceUp: false, shownTo: ['away'] }], [{ faceUp: false, shownTo: ['other'], shownCardId: TENTS }]])
        for (const perspective of [{ kind: 'player', playerId: 'ruler' } as const, spectator])
            expect(rowsSeenBy(perspective)).toEqual([[{ faceUp: false, shownTo: ['away'] }], [{ faceUp: false, shownTo: ['other'] }]])
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

const SILENCE = 'denizen.arcane.vow-of-silence'

/** Witch's Bargain with ruler, other and away all at c1, in a game created at `revision`. */
function bargainTable(revision: OathRevision, over: Record<string, Record<string, unknown>> = {}, advisers: string[] = []) {
    const s = board([WITCHS_BARGAIN], advisers, { ...over, away: { siteId: 'c1', ...over['away'] } })
    s.oathRevision = revision
    return s
}
const bargainRefusal = (s: ReturnType<typeof board>, choices: PowerChoice[]) =>
    HydratedUseActionPower.reasonCannotUse(s, 'ruler', WITCHS_BARGAIN, powerIndexOf(WITCHS_BARGAIN, PowerTiming.Action), choices)
const entry = (playerId: string, secretsGiven: number, pairsGiven: number): BargainEntry => ({ kind: PowerChoiceKind.Bargain, playerId, secretsGiven, pairsGiven })

describe("Witch's Bargain — the secret its cost places cannot be given (R-7.1.2, revision 7)", () => {
    it('with 3 secrets, giving 3 is refused, since the cost places one first; giving 2 leaves none', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 }, other: { favor: 6, secrets: 2 } })
        expect(bargainRefusal(s, [bargain('other', 3, 0)])).toBe('you have 2 secrets to give after the cost, not 3')
        actionPowerUse('ruler', WITCHS_BARGAIN, [bargain('other', 2, 0)]).apply(s)
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 8, secrets: 0 })
        expect(s.getPlayerState('other')).toMatchObject({ favor: 2, secrets: 4 })
        expect(s.tokensOn(WITCHS_BARGAIN).secrets).toBe(1)
    })

    it('in a game created before revision 7 the recorded shape replays as it did: 3 of 3 given, leaving -1', () => {
        const s = bargainTable(OathRevision.UiBatch1, { ruler: { favor: 4, secrets: 3 }, other: { favor: 6, secrets: 2 } })
        const old = [player('other'), count(3), count(0)]
        expect(bargainRefusal(s, old)).toBeUndefined()
        actionPowerUse('ruler', WITCHS_BARGAIN, old).apply(s)
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 10, secrets: -1 })
        expect(s.getPlayerState('other')).toMatchObject({ favor: 0, secrets: 5 })
    })

    it('each revision takes its own shape: one player and two counts before 7, a list of entries from 7', () => {
        const before = bargainTable(OathRevision.UiBatch1)
        const from = bargainTable(OathRevision.EngineFixes3)
        expect(bargainRefusal(before, [bargain('other', 1, 0)])).toMatch(/no choice was made/)
        expect(bargainRefusal(from, [player('other'), count(1), count(0)])).toMatch(/no choice was made/)
        expect(bargainRefusal(from, [bargain('other', 1, 0)])).toBeUndefined()
    })
})

describe("Witch's Bargain — several players at your site in one use (its Q&A, revision 7)", () => {
    it('gives secrets to one player and takes the last secret of another, paying the cost once', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 }, other: { favor: 4, secrets: 2 }, away: { favor: 1, secrets: 1 } })
        const use = actionPowerUse('ruler', WITCHS_BARGAIN, [bargain('other', 1, 0), bargain('away', 0, 1)])
        use.apply(s)
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 4, secrets: 2 })
        expect(s.getPlayerState('other')).toMatchObject({ favor: 2, secrets: 3 })
        // "Can I take someone's last secret? … Yup!"
        expect(s.getPlayerState('away')).toMatchObject({ favor: 3, secrets: 0 })
        expect(s.tokensOn(WITCHS_BARGAIN).secrets).toBe(1)
        expect(use.metadata?.targetPlayerId).toBe('other')
        expect(use.metadata?.summary).toBe(
            "Witch's Bargain: with other, gave 1 secrets for 2 favor and 0 favor for 0 secrets; with away, gave 0 secrets for 0 favor and 2 favor for 1 secrets"
        )
    })

    it("holds the totals together: yours against what you hold after the cost, each player's against theirs", () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 }, other: { favor: 4, secrets: 2 }, away: { favor: 2, secrets: 1 } })
        expect(bargainRefusal(s, [bargain('other', 2, 0), bargain('away', 1, 0)])).toBe('you have 2 secrets to give after the cost, not 3')
        expect(bargainRefusal(s, [bargain('other', 0, 2), bargain('away', 0, 1)])).toBe('you have 4 favor to give, not 6')
        expect(bargainRefusal(s, [bargain('away', 2, 0)])).toBe('away has 2 favor, not the 4 you would take')
        expect(bargainRefusal(s, [bargain('away', 0, 2)])).toBe('away has 1 secrets, not the 2 you would take')
        expect(bargainRefusal(s, [bargain('other', 1, 1), bargain('away', 1, 1)])).toBeUndefined()
    })

    it('names each player once, at your site, with something exchanged', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 }, other: { favor: 4, secrets: 2 } })
        expect(bargainRefusal(s, [bargain('other', 1, 0), bargain('other', 0, 1)])).toMatch(/chosen twice/)
        expect(bargainRefusal(s, [bargain('other', 0, 0)])).toBe('name at least one exchange')
        expect(bargainRefusal(s, [bargain('other', 1, 0), bargain('away', 0, 0)])).toBe('name at least one exchange with away')
        const apart = board([WITCHS_BARGAIN], [], { ruler: { favor: 4, secrets: 3 } })
        apart.oathRevision = OathRevision.EngineFixes3
        expect(bargainRefusal(apart, [bargain('away', 0, 1)])).toMatch(/not among the options/)
    })

    it('Vow of Silence bars the secrets given, not the favor', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 } }, [SILENCE])
        expect(bargainRefusal(s, [bargain('other', 1, 0)])).toMatch(/Vow of Silence/)
        expect(bargainRefusal(s, [bargain('other', 0, 1)])).toBeUndefined()
    })
})

describe('witchsBargainBounds — what the picker offers each player, read from the engine', () => {
    it('holds the cost secret back, and halves the favor', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 5, secrets: 3 }, other: { favor: 4, secrets: 2 }, away: { favor: 1, secrets: 1 } })
        expect(witchsBargainBounds(s, 'ruler', 'other')).toEqual({ secrets: 2, pairs: 2, silenced: false })
        // Their last secret can be taken; their one favor buys none of your secrets.
        expect(witchsBargainBounds(s, 'ruler', 'away')).toEqual({ secrets: 0, pairs: 1, silenced: false })
    })

    it("shares your holding with the other players named, and never counts a player's own entry", () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 5, secrets: 3 }, other: { favor: 4, secrets: 2 }, away: { favor: 4, secrets: 2 } })
        expect(witchsBargainBounds(s, 'ruler', 'away', [entry('other', 2, 1)])).toEqual({ secrets: 0, pairs: 1, silenced: false })
        expect(witchsBargainBounds(s, 'ruler', 'away', [entry('other', 1, 0), entry('away', 2, 2)])).toEqual({ secrets: 1, pairs: 2, silenced: false })
    })

    it('Vow of Silence leaves no secrets to give', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 4, secrets: 3 } }, [SILENCE])
        expect(witchsBargainBounds(s, 'ruler', 'other')).toEqual({ secrets: 0, pairs: 2, silenced: true })
    })

    it('agrees with the engine for every count', () => {
        const s = bargainTable(OathRevision.EngineFixes3, { ruler: { favor: 5, secrets: 3 }, other: { favor: 4, secrets: 2 }, away: { favor: 3, secrets: 1 } })
        const named = entry('other', 1, 1)
        const bounds = witchsBargainBounds(s, 'ruler', 'away', [named])
        for (let give = 0; give <= 4; give++)
            for (let pairs = 0; pairs <= 4; pairs++) {
                if (give + pairs === 0) continue
                const refused = bargainRefusal(s, [named, bargain('away', give, pairs)])
                expect(refused === undefined, `give ${give}, pairs ${pairs}: ${refused}`).toBe(give <= bounds.secrets && pairs <= bounds.pairs)
            }
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
        // R-X.3(c) — from revision 17 the keep shows the relic to the table, so it cannot be undone.
        for (const [revision, reveals] of [[OathRevision.EngineFixes13, true], [OathRevision.EngineFixes12, false]] as const) {
            const s = board([], [], {}, { oathRevision: revision })
            s.requireVault().relicDeck = ['relic.cup']
            const a = playDrawnCard(s, FAMILY_HEIRLOOM, SearchPlay.Adviser)
            expect(a.metadata?.whenPlayed).toBe('Family Heirloom: drew a relic — take it, or put it on the bottom')
            expect(a.metadata?.peeked).toEqual(['relic.cup'])
            expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, askedPlayerId: 'ruler', relicCardId: 'relic.cup' })
            const keep = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'ruler', answer: { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true } }))
            keep.apply(s)
            expect(s.getPlayerState('ruler').relicIds).toContain('relic.cup')
            expect(keep.revealsInfo, `revision ${revision}`).toBe(reveals)
        }

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
    it('the table remembers the scoured denizens on the pile; only the searcher the card they discarded from hand', () => {
        const s = board([INN, SMALL_FRIENDS], [])
        playDrawnCard(s, SALT, SearchPlay.Site)
        discardInListedOrder(s)
        const seen = Object.values(s.seenDiscardPiles).flat()
        expect(seen).toEqual(expect.arrayContaining([INN, SMALL_FRIENDS]))
        expect(seen).not.toContain(FILLER)
        expect(Object.values(s.getPlayerState('ruler').knownDiscardPiles ?? {}).flat()).toContain(FILLER)
        expect(Object.values(s.getPlayerState('other').knownDiscardPiles ?? {}).flat()).not.toContain(FILLER)
    })

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
