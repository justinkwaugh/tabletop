import { OathTestEngine } from '../testing/engine.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, Color, assert } from '@tabletop/common'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignResolveVictory, HydratedCampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { AnswerQuestion, AnswerQuestionValidator, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import type { ConspiracyPlay } from '../model/conspiracy.js'
import { HydratedTravel } from '../actions/travel.js'
import { ActionType } from '../definition/actions.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PowerQuestionKind } from '../model/question.js'
import { testPlayer, testState, withChancellor, openTurn, testVaultWithRelics } from '../testing/fixture.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { collectDefensePool } from '../util/campaign.js'
import { OathRuntime } from '../definition/runtime.js'
import { OathGameStateValidator } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import '../powers/index.js'
import { ongoingCampaign } from '../testing/required.js'
import { testGame } from '../testing/game.js'
import { actionPowerUse, battlePlanUse, card, facedown, modifierUse, player } from '../testing/choices.js'
import { INN } from '../testing/cards.js'
import { resolveModifiers, usableModifiers } from '../util/modifiers.js'

const HUNTER = 'denizen.order.relic-hunter'
const HORSE = 'relic.brass-horse'
const WOLVES = 'denizen.beast.wolves'

function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { me: 4 }, warbandsInPersonalBank: { me: 6 }, advisers: [{ cardId: HUNTER, faceUp: true }], ...over['me'] }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { foe: 2 }, warbandsInPersonalBank: { foe: 5 }, ...over['foe'] })
        ]),
        {
            denizensBySite: { c1: [], c2: [INN], p1: [WOLVES], h1: [] },
            warbandsBySite: { c1: { foe: 2 }, c2: { me: 2 }, p1: { foe: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { p1: [{ slotId: 'p1-r1' }] },
            ...state
        }
    )
    openTurn(s, 'me')
    return s
}
const choice = (targets: CampaignTarget[], plans?: { cardId: string; powerIndex: number }[]) =>
    ({ defender: { kind: 'player' as const, playerId: 'foe' }, targets: targets, attackDice: 3, plans })

describe('Relic Hunter — a facedown relic as a target', () => {
    it('only with the plan declared, only at a targeted site, one defense die each; on victory the relic comes through the vault', () => {
        const s = board()
        const plan = [battlePlanUse(HUNTER)]
        const site: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'c1' }
        const relic: CampaignTarget = { kind: CampaignTargetKind.SiteRelic, slotId: 'p1-r1' }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice([site, relic]))).toMatch(/not a targeted site/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice([site, { kind: CampaignTargetKind.Site, siteId: 'p1' }, relic]))).toMatch(/only with Relic Hunter/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'me', choice([site, { kind: CampaignTargetKind.Site, siteId: 'p1' }, relic], plan))).toBeUndefined()
        const parties = HydratedCampaign.partiesFor(s, 'me', choice([site, { kind: CampaignTargetKind.Site, siteId: 'p1' }, relic], plan))
        expect(collectDefensePool(s, parties)).toBe(3)
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', ...choice([site, { kind: CampaignTargetKind.Site, siteId: 'p1' }, relic], plan) })).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        const vault = testVaultWithRelics({})
        vault.relicFacedown['p1-r1'] = 'relic.cup'
        s.vault = vault
        const won = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'me', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
        won.apply(s)
        defendingSideChooses(s)
        // Relic Hunter — the victor sees the relic before choosing whether to send it down.
        expect(s.getPlayerState('me').knownPeekedRelic('p1-r1')).toBe('relic.cup')
        expect(won.revealsInfo).toBe(true)
        const action = buildAction(CampaignResolveVictory, { playerId: 'me', placements: [], burnFavor: false })
        const v = new HydratedCampaignResolveVictory(action)
        v.apply(s)
        expect(vault.relicFacedown['p1-r1']).toBeUndefined()
        expect(s.getPlayerState('me').relicIds).toContain('relic.cup')
        expect(s.relicSlotsAt('p1')).toEqual([])
        expect(v.metadata?.relicsTaken).toEqual(['relic.cup'])
        expect(v.revealsInfo).toBe(true)
    })

    it('the taken relic may go to the bottom of the deck instead, and the vault replays it', () => {
        const s = board()
        const plan = [battlePlanUse(HUNTER)]
        const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Site, siteId: 'p1' }, { kind: CampaignTargetKind.SiteRelic, slotId: 'p1-r1' }]
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', ...choice(targets, plan) })).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        const vault = testVaultWithRelics({})
        vault.relicFacedown['p1-r1'] = 'relic.cup'
        s.vault = vault
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'me', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
        defendingSideChooses(s)
        const v = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'me', placements: [], burnFavor: false, bottomRelicSlotIds: ['p1-r1'] }))
        v.apply(s)
        expect(s.getPlayerState('me').relicIds).not.toContain('relic.cup')
        expect(v.metadata?.relicsToDeckBottom).toEqual(['relic.cup'])
        expect(vault.relicDeck.at(-1)).toBe('relic.cup')
    })

    // R-9.4 — a relic sent to the bottom was never shown, so only the attacker knows it.
    it("keeps a relic sent to the bottom out of other players' view of the record and the state", () => {
        const s = board()
        const plan = [battlePlanUse(HUNTER)]
        const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Site, siteId: 'p1' }, { kind: CampaignTargetKind.SiteRelic, slotId: 'p1-r1' }]
        new HydratedCampaign(buildAction(Campaign, { playerId: 'me', ...choice(targets, plan) })).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        s.requireVault().relicFacedown['p1-r1'] = 'relic.cup'
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: 'me', sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
        defendingSideChooses(s)
        const v = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'me', placements: [], burnFavor: false, bottomRelicSlotIds: ['p1-r1'] }))
        v.apply(s)
        const record = v.dehydrate()
        expect(OathRuntime.visibility.actions.project(record, { kind: 'player', playerId: 'me' })).toMatchObject({ metadata: { relicsToDeckBottom: ['relic.cup'] } })
        for (const perspective of [{ kind: 'player', playerId: 'foe' } as const, { kind: 'spectator' } as const]) {
            const theirs = OathRuntime.visibility.actions.project(record, perspective)
            expect(theirs).toMatchObject({ metadata: { relicsTaken: [] } })
            expect(JSON.stringify(theirs)).not.toContain('relic.cup')
            const state = s.dehydrate()
            assert(OathGameStateValidator.Check(state), 'the engine holds canonical state')
            expect(JSON.stringify(OathRuntime.visibility.state.project(state, perspective))).not.toContain('relic.cup')
        }
    })
})

describe('Brass Horse — a peek, then a free Travel', () => {
    it('with a site holding the revealed suit, the player is asked where; without one, the next Travel is free', () => {
        const s = board({ me: { relicIds: [HORSE], advisers: [] } })
        s.requireVault().discardPiles.cradle = ['denizen.beast.rangers']
        s.discardPileCounts.cradle = 1
        const a = actionPowerUse('me', HORSE)
        a.apply(s)
        expect(a.metadata?.peeked).toEqual(['denizen.beast.rangers'])
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.TravelFreeTo, askedPlayerId: 'me', siteIds: ['p1'] })
        expect(() => new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c2' } })).apply(s)).toThrow(/not one of the sites/)
        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.TravelFreeTo, siteId: 'p1' } })).apply(s)
        expect(s.getPlayerState('me')).toMatchObject({ siteId: 'p1', supply: 6 })

        const t = board({ me: { relicIds: [HORSE], advisers: [] } })
        t.requireVault().discardPiles.cradle = ['denizen.arcane.scryer']
        t.discardPileCounts.cradle = 1
        const b = actionPowerUse('me', HORSE)
        b.apply(t)
        expect(t.pendingQuestions).toBeUndefined()
        t.actionCount += 1
        expect(HydratedTravel.plan(t, 'me', 'h1').cost).toBe(0)
    })

    it('its Q&A — not on an empty discard pile, and only to a site the Travel rules allow', () => {
        const empty = board({ me: { relicIds: [HORSE], advisers: [] } })
        empty.discardPileCounts.cradle = 0
        expect(HydratedUseActionPower.reasonCannotUse(empty, 'me', HORSE, powerIndexOf(HORSE, PowerTiming.Action))).toMatch(/discard pile is empty/)
        // Vow of Union: no leaving a ruled site with warbands on the board, so p1 is out of reach and the Travel is "as normal".
        const bound = board({ me: { relicIds: [HORSE], advisers: [{ cardId: 'denizen.beast.vow-of-union', faceUp: true }], warbandsOnBoard: { me: 2 } } }, { warbandsBySite: { c1: { me: 1 } } })
        bound.requireVault().discardPiles.cradle = ['denizen.beast.rangers']
        bound.discardPileCounts.cradle = 1
        actionPowerUse('me', HORSE).apply(bound)
        expect(bound.pendingQuestions).toBeUndefined()
    })
})

describe('Jinx — a reroll after the roll, the skulls waiting on the answer', () => {
    const JINX = 'denizen.arcane.jinx'

    it('the attacker who rules Jinx is asked after the roll; a reroll pays the card and replaces the roll; the skulls kill once it is settled', () => {
        for (let seed = 1; seed < 30; seed++) {
            const engine = new OathTestEngine(OathRuntime)
            const game = testGame(['me', 'foe'])
            const hydrated = board({ me: { advisers: [{ cardId: JINX, faceUp: true }], secrets: 3 } }, { machineState: MachineState.ActPhase, prng: { seed, invocations: 0 } })
            let state = hydrated.dehydrate()
            state.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: ['me', 'foe'], turnCounts: { me: 1, foe: 0 } }
            state.activePlayerIds = ['me']
            state = engine.runNext(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 4 }), state, game).updatedState
            expect(state.machineState).toBe(MachineState.PowerQuestion)
            expect(state.activePlayerIds).toEqual(['me'])
            const skulls = ongoingCampaign(state).attackRoll.reduce((n, f) => n + f.skulls, 0)
            expect(state.players[0].warbandsOnBoard.me).toBe(4)
            if (skulls === 0) continue
            state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.RerollDice, reroll: true } }), state, game).updatedState
            expect(state.machineState).toBe(MachineState.CampaignSacrifice)
            expect(state.cardTokens[JINX]?.secrets).toBe(1)
            const after = ongoingCampaign(state).attackRoll.reduce((n, f) => n + f.skulls, 0)
            expect(state.players[0].warbandsOnBoard.me).toBe(4 - after)
            expect(ongoingCampaign(state).pendingSkullKills).toBeUndefined()
            return
        }
        throw new Error('no seed rolled a skull')
    })

    it('keeping the roll pays nothing and the original skulls kill', () => {
        const engine = new OathTestEngine(OathRuntime)
        const game = testGame(['me', 'foe'])
        let state = board({ me: { advisers: [{ cardId: JINX, faceUp: true }] } }, { machineState: MachineState.ActPhase, prng: { seed: 7, invocations: 0 } }).dehydrate()
        state.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: ['me', 'foe'], turnCounts: { me: 1, foe: 0 } }
        state.activePlayerIds = ['me']
        state = engine.runNext(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 4 }), state, game).updatedState
        const skulls = ongoingCampaign(state).attackRoll.reduce((n, f) => n + f.skulls, 0)
        state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.RerollDice, reroll: false } }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(state.cardTokens[JINX]).toBeUndefined()
        expect(state.players[0].warbandsOnBoard.me).toBe(4 - skulls)
    })
})

describe('the small gaps closed', () => {
    it("Small Friends: a Trade modifier at a beast site is reachable, and 'you may use Trade modifiers there' holds", () => {
        const SMALL_FRIENDS = 'denizen.beast.small-friends'
        const MASTER = 'denizen.arcane.master-of-disguise'
        const s = board({ me: { advisers: [{ cardId: SMALL_FRIENDS, faceUp: true }] } }, { denizensBySite: { c1: [], c2: [INN], p1: [WOLVES, MASTER], h1: [] } })
        expect(usableModifiers(s, 'me', ActionType.Trade).map((p) => p.cardId)).toContain(MASTER)
        expect(resolveModifiers(s, 'me', ActionType.Trade, [modifierUse(MASTER, [player('foe')])], {}).reason).toBeUndefined()
        const t = board({}, { denizensBySite: { c1: [], c2: [INN], p1: [WOLVES, MASTER], h1: [] } })
        expect(usableModifiers(t, 'me', ActionType.Trade).map((p) => p.cardId)).not.toContain(MASTER)
    })

    it("Inquisitor's Conspiracy may be played with R-5.1.4.IV's take, validated as a Search's would be", () => {
        const INQUISITOR = 'denizen.arcane.inquisitor'
        const CONSPIRACY = 'vision.conspiracy'
        const s = board({ me: { advisers: [{ cardId: INN, faceUp: true }, { cardId: WOLVES, faceUp: true }], secrets: 2 }, foe: { advisers: [{ cardId: CONSPIRACY, faceUp: false }, { cardId: 'denizen.hearth.storyteller', faceUp: true }], relicIds: ['relic.cup'] } }, { denizensBySite: { c1: [INQUISITOR], c2: [], p1: [], h1: [] } })
        actionPowerUse('me', INQUISITOR, [facedown('foe', 0)]).apply(s)
        const take: ConspiracyPlay = { targetPlayerId: 'foe', take: { kind: 'relic', cardId: 'relic.cup' } }
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'me', { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true, conspiracy: take })).toMatch(/two faceup advisers/)
        s.getPlayerState('me').addAdviser('denizen.hearth.storyteller', true)
        s.getPlayerState('me').replaceAdviser(WOLVES, { cardId: 'denizen.hearth.wayside-inn', faceUp: true })
        s.getPlayerState('me').setAdvisers([{ cardId: INN, faceUp: true }, { cardId: 'denizen.hearth.storyteller', faceUp: true }])
        s.getPlayerState('foe').setAdvisers([{ cardId: CONSPIRACY, faceUp: false }, { cardId: 'denizen.hearth.fabled-feast', faceUp: true }])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'me', { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true, conspiracy: take })).toBeUndefined()
        new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'me', answer: { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true, conspiracy: take } })).apply(s)
        expect(s.getPlayerState('me').relicIds).toContain('relic.cup')
        expect(s.getPlayerState('me').secrets).toBe(1)
    })

    it("refuses a Conspiracy answer whose take is not R-5.1.4.IV's relic or banner, at the schema", () => {
        const answer = (take: unknown) => ({ id: 'a', gameId: 'g', type: ActionType.AnswerQuestion, playerId: 'me', source: ActionSource.User, index: 0, answer: { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true, conspiracy: { targetPlayerId: 'foe', take } } })
        expect(AnswerQuestionValidator.Check(answer({ kind: 'relic', cardId: 'relic.cup' }))).toBe(true)
        expect(AnswerQuestionValidator.Check(answer({ kind: 'banner', banner: 'peoplesFavor' }))).toBe(true)
        expect(AnswerQuestionValidator.Check(answer({}))).toBe(false)
        expect(AnswerQuestionValidator.Check(answer({ kind: 'banner', banner: 'nope' }))).toBe(false)
    })

    it('Homesteaders at a Great Slum may discard a denizen there first', () => {
        const HOMESTEADERS = 'denizen.hearth.homesteaders'
        const s = board({ me: { advisers: [{ cardId: HOMESTEADERS, faceUp: true }, { cardId: INN, faceUp: true }] } }, { denizensBySite: { c1: [WOLVES, 'denizen.nomad.tents', 'denizen.hearth.storyteller'], c2: [], p1: [], h1: [] }, siteCards: { c1: 'site.great-slums', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' } })
        expect(HydratedUseActionPower.reasonCannotUse(s, 'me', HOMESTEADERS, powerIndexOf(HOMESTEADERS, PowerTiming.Action), [card(INN)])).toMatch(/no room/)
        actionPowerUse('me', HOMESTEADERS, [card(INN), card(WOLVES)]).apply(s)
        expect(s.denizensBySite['c1']).toEqual(['denizen.nomad.tents', 'denizen.hearth.storyteller', INN])
    })
})
