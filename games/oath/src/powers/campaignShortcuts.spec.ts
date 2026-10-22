import { describe, expect, it } from 'vitest'
import { Color, assert } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedCampaign, Campaign, type CampaignDefender } from '../actions/campaign.js'
import { ForgoFreeAction, isForgoFreeAction } from '../actions/forgoFreeAction.js'
import { ActionType } from '../definition/actions.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { Banner, CardKind, PlayerStatus, Suit } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { registerCards } from '../data/cardRegistry.js'
import { PowerQuestionKind, RerolledRollKind } from '../model/question.js'
import { testPlayer, testState, testVaultWithRelics, openTurn } from '../testing/fixture.js'
import { PowerTiming, cardPowers, powerIndexOf } from '../data/cardPowers.js'
import { sitesRuledBy, warbandsAt } from '../util/rule.js'
import { legalChoices, PowerChoiceKind } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import { faceupSitesWithCardOfSuit } from './vocabulary.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { attackingSiteOf } from '../util/campaignSite.js'
import { killFromAttackingForce } from '../util/campaignRoll.js'
import '../powers/index.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse, site, actionPowerUse } from '../testing/choices.js'
import { INN } from '../testing/cards.js'
import { askQuestion } from '../util/questions.js'
import { answerQuestion } from '../testing/steps.js'
import { playConspiracy } from '../util/cardPlay.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { payPowerCost, reasonCannotPayPowerCost } from '../util/powerCost.js'
import { reasonPersistentForbidsCampaign } from '../util/persistent.js'
import { defendersOpenToAt } from '../util/campaign.js'

const HEARTS = 'denizen.hearth.hearts-and-minds'
const ENVOY = 'denizen.order.peace-envoy'
const WILD_ALLIES = 'denizen.beast.wild-allies'
const CAPTAINS = 'denizen.order.captains'
const HOSPITAL = 'denizen.hearth.hospital'
const RELIC_THIEF = 'denizen.discord.relic-thief'
const WOLVES = 'denizen.beast.wolves'

// c1 needs a Recover cost the fixture can pay; the Plains prints none.
registerCards([{ id: 'site.test-cheap', name: 'Cheap', kind: CardKind.Site, recoverCost: { kind: 'burnFavor', amount: 1 } }])

function board(cards: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'att', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { att: 4 }, warbandsInPersonalBank: { att: 6 }, ...over['att'] }),
            testPlayer({ playerId: 'def', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { def: 2 }, warbandsInPersonalBank: { def: 5 }, ...over['def'] }),
            testPlayer({ playerId: 'far', color: Color.Yellow, siteId: 'h1', favor: 2, secrets: 2, ...over['far'] })
        ],
        {
            denizensBySite: { c1: cards, c2: [INN], p1: [WOLVES], h1: [] },
            warbandsBySite: { c1: { def: 2 }, c2: { att: 2 }, p1: { def: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, 'att')
    return s
}
function campaign(s: ReturnType<typeof board>, fields: Record<string, unknown> = {}) {
    const a = new HydratedCampaign(buildAction(Campaign, { playerId: 'att', defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 3, ...fields }))
    a.apply(s)
    return a
}
function finish(s: ReturnType<typeof board>, sacrifice = 0) {
    const sac = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'att', sacrifice, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, sacrifice) }))
    sac.apply(s)
    defendingSideChooses(s)
    if (s.campaign) new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'att', placements: [], burnFavor: false })).apply(s)
    return sac
}

describe('Hearts and Minds and Peace Envoy — a battle decided without a roll', () => {
    it("Hearts and Minds: the defender wins outright, nothing is rolled, and the card goes unless they hold the People's Favor", () => {
        const s = board([HEARTS], { def: { favor: 5 } })
        campaign(s)
        expect(s.campaign?.pendingDefenderPlans).toBeDefined()
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'def', plans: [battlePlanUse(HEARTS)] })).apply(s)
        expect(s.campaign).toMatchObject({ decidedVictor: 'defender', attackRoll: [], defenseRoll: [], swords: 0, defense: 0 })
        expect(HydratedCampaignSacrifice.sacrificeNeeded(ongoingCampaign(s))).toBe(0)
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'att', { sacrifice: 1 })).toMatch(/already decided/)
        const before = required(s.getPlayerState('att').warbandsOnBoard['att'], 'the attacker’s red warbands')
        const sac = finish(s)
        expect(sac.metadata?.attackerVictorious).toBe(false)
        // R-5.5.6 — the defeated attacker still loses half of four.
        expect(s.getPlayerState('att').warbandsOnBoard['att']).toBe(before - 2)
        expect(sac.metadata?.planNotes?.[0]).toMatch(/discarded at the end/)
        expect(s.denizensBySite['c1']).not.toContain(HEARTS)

        const kept = board([HEARTS], { def: { favor: 5 } }, { banners: { [Banner.PeoplesFavor]: { value: 1, holderPlayerId: 'def' }, [Banner.DarkestSecret]: { value: 1 } } })
        campaign(kept)
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'def', plans: [battlePlanUse(HEARTS)] })).apply(kept)
        finish(kept)
        expect(kept.denizensBySite['c1']).toContain(HEARTS)
    })

    it("Peace Envoy: the user wins, pays the enemy a favor per defense die, and nobody's warbands die", () => {
        const s = board([], { att: { favor: 4, advisers: [{ cardId: ENVOY, faceUp: true }] } })
        const declared = campaign(s, { plans: [battlePlanUse(ENVOY)] })
        expect(s.campaign?.decidedVictor).toBe('attacker')
        expect(declared.metadata?.battle?.planNotes).toEqual(['Peace Envoy: att gave def 1 favor, one per defense die'])
        expect(s.getPlayerState('def').favor).toBe(4)
        expect(s.getPlayerState('att').favor).toBe(2)
        const sac = finish(s)
        expect(sac.metadata?.attackerVictorious).toBe(true)
        expect(sac.metadata?.defeatKilled).toBe(0)
        expect(s.getPlayerState('def').warbandsOnBoard['def']).toBe(4)
        expect(warbandsAt(s, 'c1')['def'] ?? 0).toBe(0)
        expect(HydratedCampaign.reasonCannotCampaign(board([], { att: { advisers: [{ cardId: ENVOY, faceUp: true }, { cardId: 'denizen.discord.mercenaries', faceUp: true }] } }), 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 1, plans: [battlePlanUse(ENVOY), battlePlanUse('denizen.discord.mercenaries')] })).toMatch(/cannot use other battle plans/)
    })

    it('Peace Envoy: no victory without the whole payment, one favor per defense die beyond its cost', () => {
        const poor = board([], { att: { favor: 1, advisers: [{ cardId: ENVOY, faceUp: true }] } })
        expect(HydratedCampaign.reasonCannotCampaign(poor, 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 1, plans: [battlePlanUse(ENVOY)] })).toMatch(/Peace Envoy: one favor per defense die/)
        const enough = board([], { att: { favor: 2, advisers: [{ cardId: ENVOY, faceUp: true }] } })
        expect(HydratedCampaign.reasonCannotCampaign(enough, 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 1, plans: [battlePlanUse(ENVOY)] })).toBeUndefined()
    })
})

describe('Wild Allies and Captains — a Campaign from another site', () => {
    it('Captains: the next Campaign acts from a ruled site, for no Supply, with the warbands there in the force', () => {
        const s = board([CAPTAINS], {}, { warbandsBySite: { c1: { att: 1, def: 2 }, c2: { att: 2, def: 1 }, p1: { def: 3 } } })
        actionPowerUse('att', CAPTAINS, [site('c2')]).apply(s)
        s.actionCount += 1
        expect(attackingSiteOf(s, 'att')).toBe('c2')
        expect(HydratedCampaign.supplyCostFor(s, 'att')).toBe(0)
        expect(HydratedCampaign.legalDefenders(s, 'att')).toContainEqual({ kind: 'player', playerId: 'def' })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 6 })).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 7 })).toMatch(/at most 6/)
        expect(HydratedCampaign.maxAttackDice(s, HydratedCampaign.partiesFor(s, 'att', { defender: { kind: 'player', playerId: 'def' }, targets: [] }))).toBe(6)
        const a = campaign(s, { targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 6 })
        expect(a.metadata?.supplySpent).toBe(0)
        expect(s.campaign?.forceSiteIds).toEqual(['c2'])
        expect(s.getPlayerState('att').campaignAsIf).toBeUndefined()
        expect(attackingSiteOf(s, 'att')).toBe('c2')
    })

    it('Wild Allies reaches a site with a beast card; without the power the pawn is where it is', () => {
        const s = board([WILD_ALLIES])
        expect(HydratedUseActionPower.reasonCannotUse(s, 'att', WILD_ALLIES, powerIndexOf(WILD_ALLIES, PowerTiming.Action), [site('c2')])).toMatch(/not among the options/)
        actionPowerUse('att', WILD_ALLIES, [site('p1')]).apply(s)
        s.actionCount += 1
        expect(attackingSiteOf(s, 'att')).toBe('p1')
        s.actionCount += 1
        expect(attackingSiteOf(s, 'att')).toBe('c1')
    })

    it("R-5.5.5 — a loss order naming another player's warbands at the Wild Allies site is refused", () => {
        const s = board([WILD_ALLIES])
        actionPowerUse('att', WILD_ALLIES, [site('p1')]).apply(s)
        s.actionCount += 1
        const declaration: Parameters<typeof HydratedCampaign.reasonCannotCampaign>[2] = { defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'p1' }], attackDice: 3 }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', declaration)).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', { ...declaration, skullLossOrder: [{ at: { kind: 'site', siteId: 'p1' }, owner: 'def' }] })).toMatch(/not in your force/)
        expect(() => campaign(s, { ...declaration, skullLossOrder: [{ at: { kind: 'site', siteId: 'p1' }, owner: 'def' }] })).toThrow(/not in your force/)
        expect(warbandsAt(s, 'p1')['def']).toBe(3)
    })

    it("R-5.5.5 — a sacrifice naming another player's warbands is refused", () => {
        const s = board()
        campaign(s)
        defendingSideChooses(s)
        ongoingCampaign(s).swords = 1
        ongoingCampaign(s).defense = 2
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'att', { sacrifice: 2 })).toBeUndefined()
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'att', { sacrifice: 2, sacrificeKills: [{ at: { kind: 'site', siteId: 'c1' }, owner: 'def', count: 2 }] })).toMatch(/not in the force/)
    })
})

describe('R-5.5.5, R-10.22 — the attacker chooses which of their own warbands die', () => {
    function captainsAt(c2: Record<string, number> = { att: 2, def: 1 }) {
        const s = board([CAPTAINS], {}, { warbandsBySite: { c1: { att: 1, def: 2 }, c2, p1: { def: 3 } } })
        actionPowerUse('att', CAPTAINS, [site('c2')]).apply(s)
        s.actionCount += 1
        return s
    }

    it('skull kills come from the places named first, then the rest of the force', () => {
        const s = captainsAt()
        campaign(s, { targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 0, skullLossOrder: [{ at: { kind: 'site', siteId: 'c2' }, owner: 'att' }] })
        const board = s.getPlayerState('att').warbandsOnBoard['att']
        killFromAttackingForce(s, ongoingCampaign(s), 3, [{ at: { kind: 'site', siteId: 'c2' }, owner: 'att' }])
        expect(warbandsAt(s, 'c2')['att'] ?? 0).toBe(0)
        expect(s.getPlayerState('att').warbandsOnBoard['att']).toBe(required(board, 'the board') - 1)
    })

    it('a sacrifice from a force of more than one kind names its warbands, which are the ones that die', () => {
        const s = captainsAt()
        campaign(s, { targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 1 })
        defendingSideChooses(s)
        ongoingCampaign(s).swords = 1
        ongoingCampaign(s).defense = 2
        ongoingCampaign(s).sacrificeWorth = 1
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'att', { sacrifice: 2 })).toMatch(/choose which warbands/)
        const kills = [{ at: { kind: 'site' as const, siteId: 'c2' }, owner: 'att', count: 2 }]
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, 'att', { sacrifice: 2, sacrificeKills: kills })).toBeUndefined()
        const onBoard = s.getPlayerState('att').warbandsOnBoard['att']
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'att', sacrifice: 2, sacrificeKills: kills })).apply(s)
        expect(warbandsAt(s, 'c2')['att'] ?? 0).toBe(0)
        expect(s.getPlayerState('att').warbandsOnBoard['att']).toBe(onBoard)
    })
})

describe('Hospital — a kill becomes a placement', () => {
    it("Hospital's Q&A — the saved warbands wait for the Campaign's end, then go to its site if its user still rules it", () => {
        const defendWithHospital = (denizensBySite: Record<string, string[]>) => {
            const s = board([], {}, { denizensBySite, warbandsBySite: { c1: { def: 2 }, c2: { att: 2 }, p1: { def: 3 } } })
            campaign(s)
            new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'def', plans: [battlePlanUse(HOSPITAL)] })).apply(s)
            ongoingCampaign(s).swords = 9
            ongoingCampaign(s).defense = 0
            return s
        }
        // Hospital at p1, which the defender keeps: the two saved warbands arrive there at the end.
        const kept = defendWithHospital({ c1: [], c2: [INN], p1: [HOSPITAL, WOLVES], h1: [] })
        expect(kept.campaign?.killRedirects).toEqual([{ playerId: 'def', siteId: 'p1' }])
        const bank = required(kept.getPlayerState('def').warbandsInPersonalBank['def'], 'the defender\'s blue bank')
        expectWarbandsConserved(kept, () => finish(kept))
        expect(kept.getPlayerState('def').warbandsInPersonalBank['def']).toBe(bank)
        expect(warbandsAt(kept, 'p1')['def']).toBe(5)
        // Hospital at c1, the targeted site the defender loses: nothing props it up, and the saved warbands die.
        const lost = defendWithHospital({ c1: [HOSPITAL], c2: [INN], p1: [WOLVES], h1: [] })
        finish(lost)
        expect(warbandsAt(lost, 'c1')['def'] ?? 0).toBe(0)
        expect(lost.getPlayerState('def').warbandsInPersonalBank['def']).toBe(bank + 2)
        expect(lost.campaign).toBeUndefined()
    })
})

describe('Relic Thief — a roll for the relics somebody took', () => {
    it("asks the holder after a Recover in their region; a roll with no shields takes the relics, and the power's cost is paid", () => {
        const s = board([], { far: { siteId: 'c2', advisers: [{ cardId: RELIC_THIEF, faceUp: true }], favor: 2, secrets: 2 } }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] }, vault: testVaultWithRelics({ 'c1-r1': 'relic.cup' }), siteCards: { c1: 'site.test-cheap', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        const r = new HydratedRecover(buildAction(Recover, { playerId: 'att', target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' } }))
        r.apply(s)
        expect(s.getPlayerState('att').relicIds).toContain('relic.cup')
        expect(r.metadata?.modifierNotes?.[0]).toMatch(/Relic Thief: far may roll/)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RelicThiefRoll, askedPlayerId: 'far', takerPlayerId: 'att', relicCardIds: ['relic.cup'] })
        let took = false
        for (let seed = 1; seed < 40 && !took; seed++) {
            const t = board([], { far: { siteId: 'c2', advisers: [{ cardId: RELIC_THIEF, faceUp: true }], favor: 2, secrets: 2 } }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] }, vault: testVaultWithRelics({ 'c1-r1': 'relic.cup' }), prng: { seed, invocations: 0 }, siteCards: { c1: 'site.test-cheap', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
            new HydratedRecover(buildAction(Recover, { playerId: 'att', target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' } })).apply(t)
            const a = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'far', answer: { kind: PowerQuestionKind.RelicThiefRoll, roll: true } }))
            a.apply(t)
            expect(a.revealsInfo).toBe(true)
            expect(t.getPlayerState('far')).toMatchObject({ favor: 1, secrets: 1 })
            if (t.getPlayerState('far').relicIds.includes('relic.cup')) took = true
        }
        expect(took).toBe(true)
    })

    it('is not asked when the taker is in another region, or when the holder cannot pay', () => {
        const s = board([], { far: { advisers: [{ cardId: RELIC_THIEF, faceUp: true }] } }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] }, vault: testVaultWithRelics({ 'c1-r1': 'relic.cup' }), siteCards: { c1: 'site.test-cheap', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        new HydratedRecover(buildAction(Recover, { playerId: 'att', target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' } })).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        const broke = board([], { far: { siteId: 'c2', advisers: [{ cardId: RELIC_THIEF, faceUp: true }], favor: 0 } }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] }, vault: testVaultWithRelics({ 'c1-r1': 'relic.cup' }), siteCards: { c1: 'site.test-cheap', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        const r = new HydratedRecover(buildAction(Recover, { playerId: 'att', target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' } })).apply(broke)
        expect(broke.pendingQuestions).toBeUndefined()
        void r
    })

    it('Jinx — a Relic Thief roll may be rerolled, and the relics wait on the answer', () => {
        const s = board([], { far: { siteId: 'c2', advisers: [{ cardId: RELIC_THIEF, faceUp: true }, { cardId: 'denizen.arcane.jinx', faceUp: true }], favor: 2, secrets: 3 } }, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] }, vault: testVaultWithRelics({ 'c1-r1': 'relic.cup' }), siteCards: { c1: 'site.test-cheap', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        new HydratedRecover(buildAction(Recover, { playerId: 'att', target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' } })).apply(s)
        answerQuestion(s, 'far', { kind: PowerQuestionKind.RelicThiefRoll, roll: true })
        expect(s.getPlayerState('att').relicIds).toContain('relic.cup')
        const reroll = s.pendingQuestions?.queue[0]
        expect(reroll).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: 'far', roll: { kind: RerolledRollKind.RelicThief, takerPlayerId: 'att', relicCardIds: ['relic.cup'] } })
        assert(reroll?.kind === PowerQuestionKind.RerollDice && reroll.roll.kind === RerolledRollKind.RelicThief, 'a Relic Thief reroll')
        answerQuestion(s, 'far', { kind: PowerQuestionKind.RerollDice, reroll: false })
        expect(s.getPlayerState('far').relicIds.includes('relic.cup')).toBe(reroll.roll.shields === 0)
    })

    describe('"After a player takes any relics" — every take, not only a Recover or a Campaign', () => {
        const CUP = 'relic.cup'
        const thiefBoard = () => board([], { far: { siteId: 'c2', advisers: [{ cardId: RELIC_THIEF, faceUp: true }] }, def: { relicIds: [CUP] } }, { reliquary: [{ slotId: 'reliquary.0' }] })
        const thiefAsked = (s: ReturnType<typeof board>) => s.pendingQuestions?.queue.find((q) => q.kind === PowerQuestionKind.RelicThiefRoll)

        it('Blackmail — a relic handed over rather than paid for', () => {
            const s = thiefBoard()
            askQuestion(s, 'att', { kind: PowerQuestionKind.PayOrLoseRelic, cardId: 'denizen.discord.blackmail', askedPlayerId: 'def', takerPlayerId: 'att', relicCardId: CUP, price: 2 })
            answerQuestion(s, 'def', { kind: PowerQuestionKind.PayOrLoseRelic, pay: false })
            expect(thiefAsked(s)).toMatchObject({ askedPlayerId: 'far', takerPlayerId: 'att', relicCardIds: [CUP] })
        })

        it('Blackmail — a relic taken because the price cannot be paid', () => {
            const s = thiefBoard()
            s.getPlayerState('def').favor = 0
            askQuestion(s, 'att', { kind: PowerQuestionKind.PayOrLoseRelic, cardId: 'denizen.discord.blackmail', askedPlayerId: 'def', takerPlayerId: 'att', relicCardId: CUP, price: 2 })
            expect(thiefAsked(s)).toMatchObject({ takerPlayerId: 'att', relicCardIds: [CUP] })
        })

        it('Family Heirloom and Dowsing Sticks — a drawn relic kept', () => {
            const s = thiefBoard()
            askQuestion(s, 'att', { kind: PowerQuestionKind.KeepOrBottomRelic, cardId: 'relic.dowsing-sticks', askedPlayerId: 'att', relicCardId: 'relic.map' })
            answerQuestion(s, 'att', { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true })
            expect(thiefAsked(s)).toMatchObject({ takerPlayerId: 'att', relicCardIds: ['relic.map'] })
        })

        it('Skeleton Key — a Reliquary relic taken', () => {
            const s = thiefBoard()
            askQuestion(s, 'att', { kind: PowerQuestionKind.TakeOrLeaveRelic, cardId: 'relic.skeleton-key', askedPlayerId: 'att', slotId: 'reliquary.0', relicCardId: 'relic.map' })
            answerQuestion(s, 'att', { kind: PowerQuestionKind.TakeOrLeaveRelic, take: true })
            expect(thiefAsked(s)).toMatchObject({ takerPlayerId: 'att', relicCardIds: ['relic.map'] })
        })

        it('the Conspiracy — a relic taken from its target', () => {
            const s = thiefBoard()
            playConspiracy(s, 'att', CONSPIRACY_ID, { targetPlayerId: 'def', take: { kind: 'relic', cardId: CUP } })
            expect(thiefAsked(s)).toMatchObject({ takerPlayerId: 'att', relicCardIds: [CUP] })
        })
    })
})

// R-5.5.1 — "You can choose any one other player who rules your site or whose pawn is at your site.
// If no player rules your site, you can choose the bandits." Captains and Wild Allies make the site
// they name "your site", so from revision 8 they name only a site a Campaign from there can be
// declared at.
describe('Captains and Wild Allies name only a site with a defender (R-5.5.1; revision 8)', () => {
    const DANA = 'dana'
    const RHYS = 'rhys'
    const ANN = 'ann'
    const BEA = 'bea'
    const CAL = 'cal'
    const PEACE = 'denizen.hearth.vow-of-peace'
    const BRACKEN = 'denizen.beast.bracken'
    const BIRDSONG = 'denizen.beast.birdsong'
    const HIDDEN_PLACE = 'site.the-hidden-place'
    const fixed = OathRevision.EngineFixes4
    const before = OathRevision.EngineFixes3
    const indexOf = (cardId: string) => powerIndexOf(cardId, PowerTiming.Action)

    /**
     * Dana, an Exile at c1 with Captains there, rules c1 and c2 alone, and p2, where Ann, the
     * Chancellor, stands. Rhys, an Exile, rules p1 and stands there unless moved. Wild Allies, when
     * Dana holds it, reaches the beast cards at c2 (Dana's), p1 (Rhys's) and h2 (no warbands).
     */
    function exiles({ oathRevision = fixed, rhysAt = 'p1', annAt = 'p2', danaAdvisers = [] as string[], atC1 = [CAPTAINS] } = {}) {
        const s = testState(
            [
                testPlayer({ playerId: DANA, color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { [DANA]: 4 }, advisers: danaAdvisers.map((cardId) => ({ cardId, faceUp: true })) }),
                testPlayer({ playerId: RHYS, color: Color.Blue, siteId: rhysAt, favor: 3, secrets: 1, supply: 4, warbandsOnBoard: { [RHYS]: 2 } }),
                testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: annAt, favor: 3, supply: 4, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } })
            ],
            {
                oathRevision,
                denizensBySite: { c1: atC1, c2: [WOLVES], p1: [BRACKEN], p2: [], h1: [], h2: [BIRDSONG] },
                warbandsBySite: { c1: { [DANA]: 1 }, c2: { [DANA]: 2 }, p1: { [RHYS]: 2 }, p2: { [DANA]: 1 }, h1: { [IMPERIAL_WARBANDS]: 2 } }
            }
        )
        openTurn(s, DANA)
        return s
    }

    /**
     * Bea and Cal are Citizens: Bea at c1 with Captains there, Cal away at h2. The Empire's warbands
     * alone hold c1, c2 and h1, so Ann, the Chancellor at h1, Bea and Cal all rule them (R-6.6.3).
     */
    function imperials(turn: string) {
        const s = testState(
            [
                testPlayer({ playerId: BEA, color: Color.Red, status: PlayerStatus.Citizen, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }),
                testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 4, supply: 6, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }),
                testPlayer({ playerId: CAL, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'h2', favor: 2, supply: 4, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 1 } })
            ],
            {
                oathRevision: fixed,
                denizensBySite: { c1: [CAPTAINS], c2: [], h1: [], h2: [] },
                warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [IMPERIAL_WARBANDS]: 2 }, h1: { [IMPERIAL_WARBANDS]: 2 } }
            }
        )
        openTurn(s, turn)
        return s
    }

    /** The sites the card's one choice offers. */
    function offered(s: HydratedOathGameState, playerId: string, cardId: string): string[] {
        const power = required(cardPowers(cardId)[indexOf(cardId)], `${cardId}'s Action power`)
        return legalChoices(s, playerId, power).flatMap((legal) =>
            legal.options.flatMap((option) => (option.kind === PowerChoiceKind.Site ? [option.siteId] : []))
        )
    }
    const refusal = (s: HydratedOathGameState, playerId: string, cardId: string, siteId: string) =>
        HydratedUseActionPower.reasonCannotUse(s, playerId, cardId, indexOf(cardId), [site(siteId)])

    /** The card is used on `siteId`; the next action is the free Campaign from there. */
    function usedOn(s: HydratedOathGameState, playerId: string, cardId: string, siteId: string) {
        actionPowerUse(playerId, cardId, [site(siteId)]).apply(s)
        s.actionCount += 1
        return s
    }

    /** R-5.5.1, R-5.5.2 — the defenders a Campaign acting from `siteId` has, the card's flag set by hand. */
    function defendersFrom(s: HydratedOathGameState, playerId: string, siteId: string): CampaignDefender[] {
        const copy = new HydratedOathGameState(structuredClone(s.dehydrate()))
        copy.getPlayerState(playerId).campaignAsIf = { siteId, atAction: copy.actionCount }
        return HydratedCampaign.legalDefenders(copy, playerId)
    }

    const useCaptainsOnC2 = () => buildAction(UseActionPower, { playerId: DANA, cardId: CAPTAINS, powerIndex: indexOf(CAPTAINS), choices: [site('c2')] })

    it('Captains: a site Dana rules with no other pawn and no other ruler is not offered, and naming it is refused', () => {
        const s = exiles()
        expect(offered(s, DANA, CAPTAINS)).toEqual(['p2'])
        expect(refusal(s, DANA, CAPTAINS, 'c2')).toMatch(/c2 is not among the options for a site you rule/)
        expect(refusal(s, DANA, CAPTAINS, 'c1')).toMatch(/c1 is not among the options for a site you rule/)
        expect(refusal(s, DANA, CAPTAINS, 'p2')).toBeUndefined()
        expect(() => usedOn(s, DANA, CAPTAINS, 'c2')).toThrow(/c2 is not among the options/)
        expect(s.getPlayerState(DANA).freeCampaignAtAction).toBeUndefined()
        expect(s.getPlayerState(DANA).favor).toBe(4)
    })

    it("Captains: the same site with another player's pawn there is offered, and the Campaign against them can be declared", () => {
        const s = exiles({ rhysAt: 'c2' })
        expect(offered(s, DANA, CAPTAINS)).toEqual(['c2', 'p2'])
        usedOn(s, DANA, CAPTAINS, 'c2')
        expect(HydratedCampaign.legalDefenders(s, DANA)).toEqual([{ kind: 'player', playerId: RHYS }])
        expect(HydratedCampaign.reasonCannotCampaign(s, DANA, { defender: { kind: 'player', playerId: RHYS }, targets: [{ kind: CampaignTargetKind.PawnAndFavor }], attackDice: 6 })).toBeUndefined()
    })

    it('Captains, Imperial: a Citizen naming a site the Empire holds, with no pawn there, may campaign against the Chancellor or a Citizen who shares its rule', () => {
        const s = imperials(BEA)
        expect(offered(s, BEA, CAPTAINS)).toEqual(['c1', 'c2', 'h1'])
        usedOn(s, BEA, CAPTAINS, 'c2')
        expect(HydratedCampaign.legalDefenders(s, BEA)).toEqual([
            { kind: 'player', playerId: ANN },
            { kind: 'player', playerId: CAL }
        ])
        expect(HydratedCampaign.reasonCannotCampaign(s, BEA, { defender: { kind: 'player', playerId: CAL }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 5 })).toBeUndefined()
    })

    it('Captains, Imperial: for the Chancellor, Citizens who only share the rule of a site are no defenders there (R-5.5.1.a)', () => {
        const s = imperials(ANN)
        // c1 has Bea's pawn. At c2 the Chancellor's attack makes a Citizen not Imperial, so they rule
        // nothing to target (R-5.5.2). h1 holds only the Chancellor's own pawn.
        expect(offered(s, ANN, CAPTAINS)).toEqual(['c1'])
        expect(defendersFrom(s, ANN, 'c2')).toEqual([])
        expect(refusal(s, ANN, CAPTAINS, 'c2')).toMatch(/c2 is not among the options/)
    })

    it('Wild Allies: a beast site Dana alone rules is refused; one another player rules, and an empty one the bandits hold, are offered', () => {
        const s = exiles({ danaAdvisers: [WILD_ALLIES] })
        expect(offered(s, DANA, WILD_ALLIES)).toEqual(['p1', 'h2'])
        expect(refusal(s, DANA, WILD_ALLIES, 'c2')).toMatch(/c2 is not among the options for a site with a beast card/)
        expect(defendersFrom(s, DANA, 'p1')).toEqual([{ kind: 'player', playerId: RHYS }])
        usedOn(s, DANA, WILD_ALLIES, 'h2')
        expect(HydratedCampaign.legalDefenders(s, DANA)).toEqual([{ kind: 'bandits' }])
        expect(HydratedCampaign.reasonCannotCampaign(s, DANA, { defender: { kind: 'bandits' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h2' }], attackDice: 4 })).toBeUndefined()
    })

    it('Vow of Peace ("You cannot campaign"): neither card offers a site', () => {
        const s = exiles({ rhysAt: 'c2', danaAdvisers: [PEACE, WILD_ALLIES] })
        expect(offered(s, DANA, CAPTAINS)).toEqual([])
        expect(offered(s, DANA, WILD_ALLIES)).toEqual([])
    })

    it('R-X.4 — before revision 8 Captains on a site with no defender is accepted, its free Campaign can only be given up, and the game replays; from 8 it is refused', () => {
        const game = testGame([DANA, RHYS, ANN])
        const initial = exiles({ oathRevision: before }).dehydrate()
        const used = engine.runNext(useCaptainsOnC2(), structuredClone(initial), game)
        const dana = used.updatedState.players.find((player) => player.playerId === DANA)
        expect(dana?.freeCampaignAtAction).toBe(used.updatedState.actionCount)
        expect(engine.getValidActionTypesForPlayer(game, used.updatedState, DANA)).toEqual([ActionType.ForgoFreeAction, ActionType.EndActPhase])
        const forgone = engine.runNext(buildAction(ForgoFreeAction, { playerId: DANA }), structuredClone(used.updatedState), game)
        expect(forgone.processedActions.find(isForgoFreeAction)?.metadata).toEqual({ forgone: ActionType.Campaign })
        let replayed = structuredClone(initial)
        for (const action of [...used.processedActions, ...forgone.processedActions]) {
            replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        }
        expect(replayed).toEqual(forgone.updatedState)

        expect(() => engine.runNext(useCaptainsOnC2(), exiles().dehydrate(), game)).toThrow(/c2 is not among the options/)
    })

    // The Hidden Place: "You cannot travel to here or declare campaign targets here unless you flip one secret on
    // your board facedown." Wild Allies costs a secret, paid before the Campaign is declared.
    it("Wild Allies: a site is judged after its cost is paid, so The Hidden Place needs a second faceup secret for the flip", () => {
        const withSecrets = (secrets: number) => {
            const s = exiles({ danaAdvisers: [WILD_ALLIES] })
            s.siteCards = { ...s.siteCards, p1: HIDDEN_PLACE }
            s.getPlayerState(DANA).secrets = secrets
            return s
        }
        const one = withSecrets(1)
        expect(offered(one, DANA, WILD_ALLIES)).toEqual(['h2'])
        expect(refusal(one, DANA, WILD_ALLIES, 'p1')).toMatch(/p1 is not among the options for a site with a beast card/)

        const two = withSecrets(2)
        expect(offered(two, DANA, WILD_ALLIES)).toEqual(['p1', 'h2'])
        usedOn(two, DANA, WILD_ALLIES, 'p1')
        expect(two.getPlayerState(DANA).secrets).toBe(1)
        expect(HydratedCampaign.legalDefenders(two, DANA)).toEqual([{ kind: 'player', playerId: RHYS }])
        expect(HydratedCampaign.reasonCannotCampaign(two, DANA, { defender: { kind: 'player', playerId: RHYS }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'p1' }], attackDice: 4, flipSecret: true })).toBeUndefined()
    })

    it("Captains: its favor cost leaves the secret The Hidden Place asks for, so the site is still offered", () => {
        const s = exiles()
        s.siteCards = { ...s.siteCards, p2: HIDDEN_PLACE }
        s.getPlayerState(DANA).secrets = 1
        s.getPlayerState(DANA).favor = 1
        expect(offered(s, DANA, CAPTAINS)).toEqual(['p2'])
        usedOn(s, DANA, CAPTAINS, 'p2')
        expect(s.getPlayerState(DANA)).toMatchObject({ favor: 0, secrets: 1 })
        expect(HydratedCampaign.legalDefenders(s, DANA)).toEqual([{ kind: 'player', playerId: ANN }])
    })

    it('names exactly the sites a copy of the board with the cost paid would, without copying it', () => {
        const SPELL_BREAKER = 'denizen.nomad.spell-breaker'
        /** The judgment as made on a copy before: pay the cost there, then ask for a defender from each site. */
        function onPaidCopy(s: HydratedOathGameState, cardId: string, candidates: string[]): string[] {
            const power = required(cardPowers(cardId)[indexOf(cardId)], `${cardId}'s Action power`)
            const paid = new HydratedOathGameState(structuredClone(s.dehydrate()))
            if (!reasonCannotPayPowerCost(paid, DANA, power)) payPowerCost(paid, DANA, power)
            if (reasonPersistentForbidsCampaign(paid, DANA)) return []
            return candidates.filter((siteId) => defendersOpenToAt(paid, DANA, siteId, 0).length > 0)
        }
        const named = { all: 0, some: 0, none: 0 }
        for (const rhysAt of ['p1', 'c2'])
            for (const secrets of [0, 1, 2])
                for (const favor of [0, 1, 4])
                    for (const hiddenAt of [undefined, 'c2', 'p1', 'p2', 'h2'])
                        for (const danaAdvisers of [[], [SPELL_BREAKER]]) {
                            const s = exiles({ rhysAt, danaAdvisers, atC1: [CAPTAINS, WILD_ALLIES] })
                            Object.assign(s.getPlayerState(DANA), { secrets, favor })
                            if (hiddenAt) s.siteCards = { ...s.siteCards, [hiddenAt]: HIDDEN_PLACE }
                            for (const [cardId, candidates] of [
                                [CAPTAINS, sitesRuledBy(s, DANA)],
                                [WILD_ALLIES, faceupSitesWithCardOfSuit(s, Suit.Beast)]
                            ] as const) {
                                const sites = offered(s, DANA, cardId)
                                expect(sites, `${cardId}, ${secrets} secrets, ${favor} favor, Hidden Place at ${hiddenAt}`).toEqual(onPaidCopy(s, cardId, [...candidates]))
                                named[sites.length === 0 ? 'none' : sites.length === candidates.length ? 'all' : 'some'] += 1
                            }
                        }
        expect(named.some).toBeGreaterThan(0)
        expect(named.none).toBeGreaterThan(0)
    })

    describe("on the player's own view, where host-only values cannot be read", () => {
        const game = { ...testGame([DANA, RHYS, ANN]), hotseat: false, protectedInformation: true as const }
        const dana = { kind: 'player', playerId: DANA } as const

        /** Dana's own view as their table executes on it: projected, then guarded. */
        const ownView = (s: HydratedOathGameState) =>
            OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

        /** The Act Phase offer Dana's own screen computes, and the one the server computes. */
        function offers(s: HydratedOathGameState) {
            return {
                own: engine.getValidActionTypesForPlayer(game, served(s, dana), DANA, { perspective: dana }),
                server: engine.getValidActionTypesForPlayer(game, s.dehydrate(), DANA)
            }
        }
        /** Revision 8, one secret: the table names the same sites as the server, and offers what it offers, End turn included. */
        function expectSameOnOwnView(s: HydratedOathGameState, cardId: string, sites: string[]) {
            s.getPlayerState(DANA).secrets = 1
            expect(offered(s, DANA, cardId)).toEqual(sites)
            expect(offered(ownView(s), DANA, cardId)).toEqual(sites)
            const { own, server } = offers(s)
            expect(own).toContain(ActionType.EndActPhase)
            expect(own).toEqual(server)
            return own
        }

        it('Wild Allies at their own site: the beast sites with a defender, and Use a power and End turn', () => {
            expect(expectSameOnOwnView(exiles({ atC1: [WILD_ALLIES] }), WILD_ALLIES, ['p1', 'h2'])).toContain(ActionType.UseActionPower)
        })

        it('Wild Allies with no beast site that has a defender: no site, and End turn still offered', () => {
            expectSameOnOwnView(exiles({ atC1: [WILD_ALLIES], danaAdvisers: [PEACE] }), WILD_ALLIES, [])
        })

        it('Wild Allies at their own site, The Hidden Place asking for the secret its cost takes: that site is left out', () => {
            const s = exiles({ atC1: [WILD_ALLIES] })
            s.siteCards = { ...s.siteCards, p1: HIDDEN_PLACE }
            expect(expectSameOnOwnView(s, WILD_ALLIES, ['h2'])).toContain(ActionType.UseActionPower)
        })

        it('Captains at their own site: the ruled site with a defender, and Use a power and End turn', () => {
            expect(expectSameOnOwnView(exiles(), CAPTAINS, ['p2'])).toContain(ActionType.UseActionPower)
        })

        it('Captains with no ruled site that has a defender: no site, and End turn still offered', () => {
            expectSameOnOwnView(exiles({ annAt: 'h1' }), CAPTAINS, [])
        })
    })

    it('every site the two cards offer has a legal defender from there, and every site they leave out has none', () => {
        const scenes: [string, HydratedOathGameState, string, string, string[]][] = [
            ['Captains, Exiles', exiles(), DANA, CAPTAINS, sitesRuledBy(exiles(), DANA)],
            ["Captains, Rhys's pawn at c2", exiles({ rhysAt: 'c2' }), DANA, CAPTAINS, sitesRuledBy(exiles({ rhysAt: 'c2' }), DANA)],
            ['Captains, a Citizen', imperials(BEA), BEA, CAPTAINS, sitesRuledBy(imperials(BEA), BEA)],
            ['Captains, the Chancellor', imperials(ANN), ANN, CAPTAINS, sitesRuledBy(imperials(ANN), ANN)],
            ['Wild Allies', exiles({ danaAdvisers: [WILD_ALLIES] }), DANA, WILD_ALLIES, faceupSitesWithCardOfSuit(exiles(), Suit.Beast)]
        ]
        let leftOut = 0
        for (const [name, s, playerId, cardId, candidates] of scenes) {
            const named = offered(s, playerId, cardId)
            for (const siteId of candidates) {
                expect(named.includes(siteId), `${name}: ${siteId}`).toBe(defendersFrom(s, playerId, siteId).length > 0)
            }
            leftOut += candidates.length - named.length
        }
        expect(leftOut).toBeGreaterThan(0)
    })
})
