import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { OathTestEngine, RunMode } from '../testing/engine.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Region, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { BattlePlanSide, isFree, powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { expectFavorConserved } from '../testing/census.js'
import { partiesSuspendingNobody, testPlayer, testState, withChancellor, openTurn } from '../testing/fixture.js'
import { hasEffect } from './registry.js'
import '../powers/index.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse } from '../testing/choices.js'
import { testGame } from '../testing/game.js'
import { discardInListedOrder, answerQuestion } from '../testing/steps.js'
import { INN } from '../testing/cards.js'
import { adviser } from '../testing/tables.js'
import { OathRevision } from '../util/revision.js'

/** R-5.5.8, R-X.1 — its "may" is asked once the Campaign ends. */
const WILD_MOUNTS = 'denizen.nomad.wild-mounts'
const HORSE_ARCHERS = 'denizen.nomad.horse-archers'
const LANCERS = 'denizen.nomad.lancers'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
const WOLVES = 'denizen.beast.wolves'
const ERRAND_BOY = 'denizen.beast.errand-boy'
const BIRDSONG = 'denizen.beast.birdsong'
const FOREST_COUNCIL = 'denizen.beast.forest-council'

const ME = 'me'
const FOE = 'foe'

const POWER = powersWithTiming(WILD_MOUNTS, PowerTiming.BattlePlan)[0]

function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [ME]: 6 }, advisers: [adviser(WILD_MOUNTS), adviser(HORSE_ARCHERS), adviser(LANCERS)], ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [FOE]: 2 }, ...over[FOE] })
        ]),
        {
            denizensBySite: { c1: [], c2: [WOLVES, INN], p1: [ERRAND_BOY] },
            warbandsBySite: { c1: { [FOE]: 1 }, c2: { [ME]: 1 }, p1: { [FOE]: 1 } },
            ...state
        }
    )
    openTurn(s, ME)
    return s
}
type Board = ReturnType<typeof board>

const declared = (plans: string[]) => ({ defender: { kind: 'player' as const, playerId: FOE }, targets: [{ kind: CampaignTargetKind.Site as const, siteId: 'c1' }], attackDice: 3, plans: plans.map(battlePlanUse) })
function campaign(s: Board, plans: string[]) {
    new HydratedCampaign(buildAction(Campaign, { playerId: ME, ...declared(plans) })).apply(s)
}
function defend(s: Board, plans: string[]) {
    new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: FOE, plans: plans.map(battlePlanUse) })).apply(s)
}
/** The battle's result is set by hand: only the end of the Campaign is under test. */
function lose(s: Board) {
    if (!s.campaign?.decidedVictor) Object.assign(s.campaign ?? {}, { swords: 0, defense: 9 })
    const action = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: ME, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
    action.apply(s)
    defendingSideChooses(s)
    return action
}
function win(s: Board) {
    Object.assign(s.campaign ?? {}, { swords: 9, defense: 0 })
    new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: ME, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
    defendingSideChooses(s)
    const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ME, placements: [], burnFavor: false }))
    action.apply(s)
    defendingSideChooses(s)
    return action
}
const instead = (insteadCardId?: string): QuestionAnswer => ({ kind: PowerQuestionKind.DiscardInstead, insteadCardId })
function answer(s: Board, playerId: string, reply: QuestionAnswer) {
    const action = answerQuestion(s, playerId, reply)
    defendingSideChooses(s)
    return action
}
const advisersOf = (s: Board, playerId: string) => s.getPlayerState(playerId).advisers.map((a) => a.cardId)
const piles = (s: Board) => s.discardPileCounts[Region.Cradle] + s.discardPileCounts[Region.Provinces] + s.discardPileCounts[Region.Hinterland]

describe('Wild Mounts — registered', () => {
    it('a battle plan for either side, with no cost, and built', () => {
        expect(hasEffect(POWER)).toBe(true)
        expect(POWER.battlePlanSide).toBe(BattlePlanSide.Either)
        expect(isFree(POWER.cost)).toBe(true)
        const s = board({ [FOE]: { advisers: [adviser(WILD_MOUNTS)] } })
        expect(usableBattlePlans(s, ME, BattlePlanSide.Attacker, partiesSuspendingNobody(s, ME)).map((p) => p.cardId)).toContain(WILD_MOUNTS)
        expect(usableBattlePlans(s, FOE, BattlePlanSide.Defender, partiesSuspendingNobody(s, ME)).map((p) => p.cardId)).toContain(WILD_MOUNTS)
    })

    it('using it costs nothing, and it prints no "At end, discard" of its own: R-5.5.8 never reaches it', () => {
        const s = board()
        campaign(s, [WILD_MOUNTS])
        expect(s.getPlayerState(ME)).toMatchObject({ favor: 4, secrets: 2 })
        expect(s.tokensOn(WILD_MOUNTS)).toEqual({ favor: 0, secrets: 0 })
        expect(s.campaign?.discardAtEnd).toEqual([])
        lose(s)
        expect(advisersOf(s, ME)).toContain(WILD_MOUNTS)
        expect(s.pendingQuestions).toBeUndefined()
    })
})

describe('Wild Mounts — "If you would discard any number of nomad battle plans"', () => {
    it('any number of nomad battle plans: every one its user owes at the end is named in one question, a defeat or a victory alike', () => {
        const lost = board()
        campaign(lost, [WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        lose(lost)
        expect(lost.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.DiscardInstead, cardId: WILD_MOUNTS, askedPlayerId: ME, planCardIds: [HORSE_ARCHERS, LANCERS], insteadCardIds: [WOLVES], actingPlayerId: ME }
        ])
        const won = board()
        campaign(won, [WILD_MOUNTS, HORSE_ARCHERS])
        win(won)
        expect(won.campaign).toBeUndefined()
        expect(won.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.DiscardInstead, askedPlayerId: ME, planCardIds: [HORSE_ARCHERS] }])
    })

    it('nomad battle plans: an end discard of another suit goes as printed, and is not named', () => {
        const s = board({ [FOE]: { advisers: [adviser(WILD_MOUNTS), adviser(STORM_CALLER), adviser(HEARTS_AND_MINDS)] } }, { denizensBySite: { c1: [], c2: [], p1: [ERRAND_BOY] } })
        campaign(s, [])
        defend(s, [WILD_MOUNTS, STORM_CALLER, HEARTS_AND_MINDS])
        lose(s)
        expect(advisersOf(s, FOE)).toEqual([WILD_MOUNTS, STORM_CALLER])
        expect(piles(s)).toBe(1)
        expect(s.pendingQuestions?.queue).toMatchObject([{ askedPlayerId: FOE, planCardIds: [STORM_CALLER], insteadCardIds: [ERRAND_BOY], actingPlayerId: ME }])
    })

    it('if YOU would discard: the other side’s nomad plans are theirs to discard, as printed', () => {
        const s = board({ [FOE]: { advisers: [adviser(STORM_CALLER)] } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        defend(s, [STORM_CALLER])
        lose(s)
        expect(advisersOf(s, FOE)).toEqual([])
        expect(piles(s)).toBe(1)
        expect(s.pendingQuestions?.queue).toMatchObject([{ askedPlayerId: ME, planCardIds: [LANCERS] }])
    })
})

describe('Wild Mounts — "you may"', () => {
    it('you may: nothing is discarded until the user answers (R-X.1)', () => {
        const s = board()
        campaign(s, [WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        lose(s)
        expect(s.campaign).toBeUndefined()
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        expect(s.denizensBySite.c2).toEqual([WOLVES, INN])
        expect(piles(s)).toBe(0)
    })

    it('you may: declining discards the plans as printed, in the order their discarder picks (Law Glossary "Discard")', () => {
        const s = board()
        campaign(s, [WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        lose(s)
        const reply = answer(s, ME, instead())
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS])
        expect(s.denizensBySite.c2).toEqual([WOLVES, INN])
        expect(reply.metadata).toMatchObject({ pileDeposits: [], summary: `discarded ${HORSE_ARCHERS}, ${LANCERS} as printed` })
        expect(s.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.OrderDiscards, askedPlayerId: ME, cardIds: [HORSE_ARCHERS, LANCERS], fromRegion: Region.Cradle }])
        expect(s.discardPileCounts[Region.Provinces]).toBe(0)

        const ordered = discardInListedOrder(s)
        expect(s.discardPileCounts[Region.Provinces]).toBe(2)
        expect(ordered.metadata?.pileDeposits).toEqual([{ region: Region.Provinces, cardIds: [HORSE_ARCHERS, LANCERS] }])
    })
})

describe('Wild Mounts — "instead discard any one beast card you rule"', () => {
    it('instead discard any one beast card: it alone goes (R-10.5: its favor to its bank), and every plan stays', () => {
        const s = board({}, { cardTokens: { [WOLVES]: { favor: 2, secrets: 0 } }, favorSupply: 16 })
        campaign(s, [WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        lose(s)
        let reply: HydratedAnswerQuestion | undefined
        expectFavorConserved(s, () => {
            reply = answer(s, ME, instead(WOLVES))
        })
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS, HORSE_ARCHERS, LANCERS])
        expect(s.denizensBySite.c2).toEqual([INN])
        expect(piles(s)).toBe(1)
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(s.favorBank[Suit.Beast]).toBe(5)
        expect(s.tokensOn(WOLVES)).toEqual({ favor: 0, secrets: 0 })
        expect(reply?.metadata).toMatchObject({ pileDeposits: [{ region: Region.Provinces, cardIds: [WOLVES] }], summary: `discarded ${WOLVES} instead of ${HORSE_ARCHERS}, ${LANCERS}` })
        expect(reply?.revealsInfo).toBe(true)
    })

    it('a beast card: no other suit, in the domain or in the answer', () => {
        const s = board()
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ insteadCardIds: [WOLVES] })
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, instead(INN))).toBe(`${INN} is not one of the cards you may discard instead`)
    })

    it('you rule: an adviser and a card at a site you rule are; a beast card at a site another player rules is not', () => {
        const s = board({ [ME]: { advisers: [adviser(WILD_MOUNTS), adviser(LANCERS), adviser(BIRDSONG)] } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ insteadCardIds: [BIRDSONG, WOLVES] })
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, instead(ERRAND_BOY))).toMatch(/is not one of the cards you may discard instead/)
        answer(s, ME, instead(BIRDSONG))
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS, LANCERS])
    })

    it('a pick outside the domain is refused, and so is one the player has stopped ruling; only the asked player answers', () => {
        const s = board()
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, instead('denizen.beast.no-such-card'))).toMatch(/is not one of the cards you may discard instead/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, FOE, instead())).toBe("the question is me's to answer")
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true })).toMatch(/the question is discardInstead/)
        s.warbandsBySite.c2 = { [FOE]: 1 }
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, instead(WOLVES))).toBe(`you no longer rule ${WOLVES}`)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, instead())).toBeUndefined()
    })

    it('Law Glossary "Discard": the beast card leaves from its own region, not the attacker’s', () => {
        const s = board({ [ME]: { advisers: [adviser(WILD_MOUNTS), adviser(LANCERS)] } }, { denizensBySite: { c1: [], c2: [], p1: [ERRAND_BOY] }, warbandsBySite: { c1: { [FOE]: 1 }, c2: {}, p1: { [ME]: 1 } } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        const reply = answer(s, ME, instead(ERRAND_BOY))
        expect(s.denizensBySite.p1).toEqual([])
        expect(s.discardPileCounts[Region.Hinterland]).toBe(1)
        expect(reply.metadata?.pileDeposits).toEqual([{ region: Region.Hinterland, cardIds: [ERRAND_BOY] }])
    })

    it('a facedown adviser has no suit (R-5.1.4.II), so it is no beast card', () => {
        const s = board({ [ME]: { advisers: [adviser(WILD_MOUNTS), adviser(LANCERS), adviser(BIRDSONG, false)] } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ insteadCardIds: [WOLVES] })
    })

    it('a locked beast card cannot be the one (R-7.2.2)', () => {
        const s = board({}, { denizensBySite: { c1: [], c2: [FOREST_COUNCIL, WOLVES], p1: [] } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ insteadCardIds: [WOLVES] })
    })
})

describe('Wild Mounts — when it does nothing', () => {
    it('ruled but not used: the plans go as printed and nobody is asked (R-7.5.2)', () => {
        const s = board()
        campaign(s, [HORSE_ARCHERS, LANCERS])
        lose(s)
        // Law Glossary "Discard" — the two plans' order is the attacker's.
        discardInListedOrder(s)
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS])
        expect(s.discardPileCounts[Region.Provinces]).toBe(2)
        expect(s.pendingQuestions?.queue ?? []).toEqual([])
    })

    it('with no beast card ruled the plans go as printed and nobody is asked', () => {
        const s = board({}, { denizensBySite: { c1: [], c2: [INN], p1: [ERRAND_BOY] } })
        campaign(s, [WILD_MOUNTS, LANCERS])
        lose(s)
        expect(advisersOf(s, ME)).toEqual([WILD_MOUNTS, HORSE_ARCHERS])
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('the bandits are nobody to ask: their compelled plans go as printed (R-5.5.3)', () => {
        const s = board({ [ME]: { siteId: 'h1', advisers: [] } }, { denizensBySite: { h1: [WILD_MOUNTS, STORM_CALLER, WOLVES] }, warbandsBySite: {} })
        new HydratedCampaign(buildAction(Campaign, { playerId: ME, defender: { kind: 'bandits' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }], attackDice: 3 })).apply(s)
        expect(s.campaign?.plansUsedBy).toEqual({ bandits: [WILD_MOUNTS, STORM_CALLER] })
        lose(s)
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS, WOLVES])
        expect(s.discardPileCounts[Region.Cradle]).toBe(1)
        expect(s.pendingQuestions).toBeUndefined()
    })
})

describe('Wild Mounts — the bandits, by its Q&A (revision 4)', () => {
    const MOUNTED = OathRevision.CardFixes1
    /** The attacker campaigns at h1 against the bandits, who rule every site without warbands. */
    function bandits(denizensBySite: Record<string, string[]>, oathRevision: number = MOUNTED, warbandsBySite: Record<string, Record<string, number>> = {}) {
        const s = board({ [ME]: { siteId: 'h1', advisers: [] } }, { oathRevision, denizensBySite: { c1: [], c2: [], p1: [], p2: [], h1: [], ...denizensBySite }, warbandsBySite })
        new HydratedCampaign(buildAction(Campaign, { playerId: ME, defender: { kind: 'bandits' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }], attackDice: 3 })).apply(s)
        return s
    }
    const pile = (s: Board) => ({ ...s.discardPileCounts })

    it('two nomad battle plans: they discard the first beast card they rule from the top of the Cradle instead, and nobody is asked', () => {
        const s = bandits({ c2: [WOLVES], p1: [ERRAND_BOY], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] })
        expect(s.campaign?.plansUsedBy).toEqual({ bandits: [HORSE_ARCHERS, WILD_MOUNTS, STORM_CALLER] })
        const sacrifice = lose(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        expect(s.campaign).toBeUndefined()
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS, STORM_CALLER])
        expect(s.denizensBySite.p2).toEqual([HORSE_ARCHERS])
        // R-10.5 — the beast card leaves the Cradle for the Provinces' pile.
        expect(s.denizensBySite.c2).toEqual([])
        expect(s.denizensBySite.p1).toEqual([ERRAND_BOY])
        expect(pile(s)).toEqual({ [Region.Cradle]: 0, [Region.Provinces]: 1, [Region.Hinterland]: 0 })
        expect(s.vault?.discardPiles[Region.Provinces][0]).toBe(WOLVES)
    })

    it('a victory or a defeat alike: the end discard is the same', () => {
        const s = bandits({ c2: [WOLVES], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] })
        win(s)
        expect(s.campaign).toBeUndefined()
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.denizensBySite.c2).toEqual([])
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS, STORM_CALLER])
        expect(s.denizensBySite.p2).toEqual([HORSE_ARCHERS])
    })

    it('the first one they rule: a beast card at a site a player rules is passed over', () => {
        const s = bandits({ c1: [WOLVES], p1: [ERRAND_BOY], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] }, MOUNTED, { c1: { [FOE]: 1 } })
        lose(s)
        expect(s.denizensBySite.c1).toEqual([WOLVES])
        expect(s.denizensBySite.p1).toEqual([])
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS, STORM_CALLER])
        expect(pile(s)).toEqual({ [Region.Cradle]: 0, [Region.Provinces]: 0, [Region.Hinterland]: 1 })
    })

    it('a locked beast card cannot be the one (R-7.2.2): the search goes on past it', () => {
        const s = bandits({ c1: [FOREST_COUNCIL], c2: [WOLVES], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] })
        lose(s)
        expect(s.denizensBySite.c1).toEqual([FOREST_COUNCIL])
        expect(s.denizensBySite.c2).toEqual([])
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS, STORM_CALLER])
    })

    it('two or more: a single nomad battle plan goes as printed', () => {
        const s = bandits({ c2: [WOLVES], h1: [WILD_MOUNTS, STORM_CALLER] })
        lose(s)
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS])
        expect(s.denizensBySite.c2).toEqual([WOLVES])
        expect(pile(s)).toEqual({ [Region.Cradle]: 1, [Region.Provinces]: 0, [Region.Hinterland]: 0 })
    })

    it('with no unlocked beast card ruled, the plans go as printed', () => {
        const s = bandits({ c1: [FOREST_COUNCIL], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] })
        lose(s)
        expect(s.denizensBySite.c1).toEqual([FOREST_COUNCIL])
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS])
        expect(s.denizensBySite.p2).toEqual([])
    })

    it('Wild Mounts at a site a player rules is no plan of theirs: the plans go as printed', () => {
        const s = bandits({ c1: [WILD_MOUNTS], c2: [WOLVES], h1: [STORM_CALLER], p2: [HORSE_ARCHERS] }, MOUNTED, { c1: { [FOE]: 1 } })
        expect(s.campaign?.plansUsedBy).toEqual({ bandits: [HORSE_ARCHERS, STORM_CALLER] })
        lose(s)
        expect(s.denizensBySite.c2).toEqual([WOLVES])
        expect(s.denizensBySite.h1).toEqual([])
        expect(s.denizensBySite.p2).toEqual([])
    })

    it('R-X.4 — before revision 4 the bandits discard as printed', () => {
        const s = bandits({ c2: [WOLVES], h1: [WILD_MOUNTS, STORM_CALLER], p2: [HORSE_ARCHERS] }, OathRevision.PlanCostsAndSearchPlays)
        lose(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.denizensBySite.c2).toEqual([WOLVES])
        expect(s.denizensBySite.h1).toEqual([WILD_MOUNTS])
        expect(s.denizensBySite.p2).toEqual([])
        expect(pile(s)).toEqual({ [Region.Cradle]: 1, [Region.Provinces]: 0, [Region.Hinterland]: 1 })
    })
})

describe('R-X.4 — a Campaign against the bandits with Wild Mounts replays as it was recorded', () => {
    const engine = new OathTestEngine(OathRuntime)
    const game = testGame([ME, FOE])
    const denizensBySite = { c1: [], c2: [WOLVES], p1: [], p2: [HORSE_ARCHERS], h1: [WILD_MOUNTS, STORM_CALLER] }

    function record(oathRevision: number, seed: number) {
        const start = board({ [ME]: { siteId: 'h1', advisers: [] } }, { oathRevision, denizensBySite, warbandsBySite: {}, prng: { seed, invocations: 0 } }).dehydrate()
        let state: OathProjectedState = structuredClone(start)
        const processed: GameAction[] = []
        const run = (action: GameAction) => {
            const result = engine.runNext(action, state, game)
            processed.push(...result.processedActions)
            state = result.updatedState
        }
        run(buildAction(Campaign, { playerId: ME, defender: { kind: 'bandits' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }], attackDice: 3 }))
        const rolled = state.campaign
        if (!rolled || rolled.swords > rolled.defense) return undefined
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(state), 0)
        run(buildAction(CampaignSacrifice, { playerId: ME, sacrifice: 0, defeatKills }))
        return { start, processed, recorded: state }
    }

    function recordedWhereBanditsWin(oathRevision: number) {
        for (let seed = 1; seed < 400; seed++) {
            const found = record(oathRevision, seed)
            if (found) return found
        }
        throw new Error('no seed gave the bandits the win')
    }

    function replay(start: OathProjectedState, processed: readonly GameAction[]) {
        let replayed = structuredClone(start)
        for (const action of processed) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        return replayed
    }

    it.each([
        ['revision 3', OathRevision.PlanCostsAndSearchPlays],
        ['revision 4', OathRevision.CardFixes1]
    ])('%s: every action replayed alone reaches the recorded state', (_name, oathRevision) => {
        const { start, processed, recorded } = recordedWhereBanditsWin(oathRevision)
        expect(recorded.campaign).toBeUndefined()
        expect(replay(start, processed)).toEqual(recorded)
    })

    it('revision 3 discarded the two nomad plans; revision 4 discarded the beast card instead', () => {
        const old = recordedWhereBanditsWin(OathRevision.PlanCostsAndSearchPlays).recorded
        expect(old.denizensBySite).toMatchObject({ c2: [WOLVES], p2: [], h1: [WILD_MOUNTS] })
        const now = recordedWhereBanditsWin(OathRevision.CardFixes1).recorded
        expect(now.denizensBySite).toMatchObject({ c2: [], p2: [HORSE_ARCHERS], h1: [WILD_MOUNTS, STORM_CALLER] })
    })
})

describe('Wild Mounts — the question is a turn, through the engine', () => {
    const engine = new OathTestEngine(OathRuntime)
    const game = testGame([ME, FOE])
    let seq = 0
    const stamp = (index: number) => ({ id: `wm-${(seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index })

    it('the defender who used it is put on the clock as the Campaign ends, the vault takes the beast card, and the attacker’s Act Phase resumes', () => {
        // Hearts and Minds makes the defender victorious with no roll, so the walk needs no seed.
        const s = board({ [FOE]: { advisers: [adviser(WILD_MOUNTS), adviser(STORM_CALLER), adviser(HEARTS_AND_MINDS)] } })
        let state = s.dehydrate()
        state.turnManager = { series: [{ type: 'turn', playerId: ME, start: 0 }], turnOrder: [ME, FOE], turnCounts: { [ME]: 1, [FOE]: 1 } }
        state.activePlayerIds = [ME]

        const attack: Campaign = { ...stamp(state.actionCount), type: ActionType.Campaign, playerId: ME, ...declared([]) }
        state = engine.run(attack, state, game).updatedState
        expect(state.machineState).toBe(MachineState.CampaignPlans)
        expect(state.activePlayerIds).toEqual([FOE])

        const plans: CampaignDefend = { ...stamp(state.actionCount), type: ActionType.CampaignDefend, playerId: FOE, plans: [WILD_MOUNTS, STORM_CALLER, HEARTS_AND_MINDS].map(battlePlanUse) }
        state = engine.run(plans, state, game).updatedState
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(state.activePlayerIds).toEqual([ME])

        const kills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(state), 0)
        const concede: CampaignSacrifice = { ...stamp(state.actionCount), type: ActionType.CampaignSacrifice, playerId: ME, sacrifice: 0, defeatKills: kills }
        state = engine.run(concede, state, game).updatedState
        expect(state.campaign).toBeUndefined()
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([FOE])
        expect(engine.getValidActionTypesForPlayer(game, state, FOE)).toContain(ActionType.AnswerQuestion)
        expect(engine.getValidActionTypesForPlayer(game, state, FOE)).not.toContain(ActionType.Campaign)
        expect(engine.getValidActionTypesForPlayer(game, state, ME)).not.toContain(ActionType.AnswerQuestion)

        const reply: AnswerQuestion = { ...stamp(state.actionCount), type: ActionType.AnswerQuestion, playerId: FOE, answer: instead(ERRAND_BOY) }
        state = engine.run(reply, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([ME])
        expect(state.pendingQuestions).toBeUndefined()
        expect(state.denizensBySite.p1).toEqual([])
        expect(state.players[1].advisers.map((a) => a.cardId)).toEqual([WILD_MOUNTS, STORM_CALLER])
        expect(state.vault?.discardPiles[Region.Hinterland][0]).toBe(ERRAND_BOY)
    })
})
