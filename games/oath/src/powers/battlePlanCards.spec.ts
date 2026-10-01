import { describe, expect, it } from 'vitest'
import { machineContext, buildAction, joinDefence } from '../testing/actions.js'
import { Color } from '@tabletop/common'
import { HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaign } from '../actions/campaign.js'
import { CampaignAttackPlans, HydratedCampaignAttackPlans } from '../actions/campaignAttackPlans.js'
import { HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { CampaignPlansStateHandler } from '../stateHandlers/campaigning.js'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import '../powers/index.js'
import { ongoingCampaign } from '../testing/required.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ATTACKER, DEFENDER, campaign, defend, finishCampaign } from '../testing/steps.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

const PROVISIONS = 'denizen.hearth.extra-provisions'
const STORM = 'denizen.nomad.storm-caller'
const SCOUTS = 'denizen.order.scouts'
const OUTRIDERS = 'denizen.order.outriders'


function table(
    over: Record<string, unknown> = {},
    advisers: { attacker?: string[]; defender?: string[] } = {},
    seed = 1
) {
    return testState(
        [
            testPlayer({
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 5,
                favor: 3,
                warbandsOnBoard: { [ATTACKER]: 5 },
                warbandsInPersonalBank: { [ATTACKER]: 7 },
                advisers: (advisers.attacker ?? []).map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                favor: 6,
                warbandsOnBoard: { [DEFENDER]: 4 },
                warbandsInPersonalBank: { [DEFENDER]: 6 },
                advisers: (advisers.defender ?? []).map((cardId) => ({ cardId, faceUp: true }))
            }),
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 15 }
            })
        ],
        {
            chancellorPlayerId: 'chancellor',
            warbandsBySite: { c1: { [DEFENDER]: 1 }, p1: { [DEFENDER]: 3 } },
            prng: { seed, invocations: 0 },
            ...over
        }
    )
}

describe('the attacker\'s battle plans ride the Campaign (R-5.5.3)', () => {
    it('Scouts: gains 1 Supply on use, and the Campaign rolls as normal', () => {
        const s = table({}, { attacker: [SCOUTS] })
        const action = campaign({ plans: [battlePlanUse(SCOUTS)] })
        action.apply(s)
        expect(s.getPlayerState(ATTACKER).supply).toBe(5 - 2 + 1)
        expect(action.metadata?.battle?.plansUsed).toEqual([SCOUTS])
        expect(action.metadata?.battle?.awaitingDefender).toBeUndefined()
        expect(s.campaign?.attackRoll.length).toBe(3)
    })

    it('Outriders: the skulls kill nothing', () => {
        // A seed whose plain roll kills at least one warband, so Outriders has skulls to cancel.
        let seed = 1
        for (; seed < 500; seed++) {
            const plain = table({}, {}, seed)
            const a = campaign()
            a.apply(plain)
            if ((a.metadata?.battle?.skullsKilled ?? 0) > 0) break
        }
        expect(seed).toBeLessThan(500)

        const s = table({}, { attacker: [OUTRIDERS] }, seed)
        const action = campaign({ plans: [battlePlanUse(OUTRIDERS)] })
        action.apply(s)
        expect(action.metadata?.battle?.skullsKilled).toBe(0)
        expect(s.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(5)
        expect(s.campaign?.ignoreSkulls).toBe(true)
    })

    it('refuses a defender-side plan, an unruled plan, and a plan used twice', () => {
        expect(() => campaign({ plans: [battlePlanUse(STORM)] }).apply(table({}, { attacker: [STORM] }))).toThrow(
            /defender plan/
        )
        // R-7.5.1 — the attacker stands at c1 but the defender rules it.
        expect(() =>
            campaign({ plans: [battlePlanUse(SCOUTS)] }).apply(table({ denizensBySite: { c1: [SCOUTS] } }))
        ).toThrow(/do not rule/)
        expect(() =>
            campaign({ plans: [battlePlanUse(SCOUTS), battlePlanUse(SCOUTS)] }).apply(table({}, { attacker: [SCOUTS] }))
        ).toThrow(/used twice/)
    })

    it('refuses a plan sent through UseActionPower', () => {
        const s = table({}, { attacker: [SCOUTS] })
        openTurn(s, ATTACKER)
        const use = new HydratedUseActionPower(
            buildAction(UseActionPower, { playerId: ATTACKER, cardId: SCOUTS, powerIndex: battlePlanUse(SCOUTS).powerIndex })
        )
        expect(() => use.apply(s)).toThrow()
    })
})

describe('the defender\'s step holds the machine (R-5.5.3, R-7.5.2)', () => {
    it('with a usable defender plan, nothing is rolled until the defender answers', () => {
        const s = table({}, { defender: [PROVISIONS] })
        const action = campaign()
        action.apply(s)
        expect(action.metadata?.battle?.awaitingDefender).toBe(true)
        expect(s.campaign?.pendingDefenderPlans).toBeDefined()
        expect(s.campaign?.attackRoll).toEqual([])
        expect(s.prng.invocations).toBe(0)
        expect(new ActPhaseStateHandler().onAction(action, machineContext(s))).toBe(MachineState.CampaignPlans)

        expect(
            HydratedCampaignSacrifice.reasonCannotResolve(s, ATTACKER, { sacrifice: 0, defeatKills: [] })
        ).toMatch(/yet to use/)
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ATTACKER, [])).toMatch(/only the defender/)
        const handler = new CampaignPlansStateHandler()
        expect(handler.validActionsForPlayer(DEFENDER, machineContext(s))).toEqual([ActionType.CampaignDefend])
        expect(handler.validActionsForPlayer(ATTACKER, machineContext(s))).toEqual([])
    })

    it('Extra Provisions: places a favor, adds a defense die, then rolls', () => {
        const s = table({}, { defender: [PROVISIONS] })
        openTurn(s, ATTACKER)
        campaign().apply(s)
        const base = ongoingCampaign(s).defensePool
        const bank = s.favorBank[Suit.Hearth]
        const answer = defend([battlePlanUse(PROVISIONS)])
        answer.apply(s)
        expect(s.getPlayerState(DEFENDER).favor).toBe(5)
        // R-7.1.2.a — paid out of turn, the favor goes to the matching bank, not onto the card.
        expect(s.favorBank[Suit.Hearth]).toBe(bank + 1)
        expect(s.tokensOn(PROVISIONS).favor).toBe(0)
        expect(s.campaign?.defensePool).toBe(base + 1)
        expect(s.campaign?.defenseRoll.length).toBe(base + 1)
        expect(s.campaign?.pendingDefenderPlans).toBeUndefined()
        expect(s.campaign?.plansUsed).toEqual([PROVISIONS])
        expect(new CampaignPlansStateHandler().onAction(answer, machineContext(s))).toBe(
            MachineState.CampaignSacrifice
        )
        expect(
            HydratedCampaignSacrifice.reasonCannotResolve(s, ATTACKER, {
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
            })
        ).toBeUndefined()
    })

    it('declining is `plans: []` and rolls the base pools', () => {
        const s = table({}, { defender: [PROVISIONS] })
        campaign().apply(s)
        const base = ongoingCampaign(s).defensePool
        defend([]).apply(s)
        expect(s.campaign?.defensePool).toBe(base)
        expect(s.campaign?.defenseRoll.length).toBe(base)
        expect(s.getPlayerState(DEFENDER).favor).toBe(6)
    })

    it('with no usable defender plan the Campaign rolls itself, as before', () => {
        const s = table()
        const action = campaign()
        action.apply(s)
        expect(action.metadata?.battle?.awaitingDefender).toBeUndefined()
        expect(s.campaign?.pendingDefenderPlans).toBeUndefined()
        expect(s.campaign?.attackRoll.length).toBe(3)
    })

    it('an unaffordable defender plan does not hold the machine', () => {
        const s = table({}, { defender: [PROVISIONS] })
        s.getPlayerState(DEFENDER).favor = 0
        const action = campaign()
        action.apply(s)
        expect(action.metadata?.battle?.awaitingDefender).toBeUndefined()
    })
})

describe('Storm Caller (R-5.5.8 "at end, discard")', () => {
    it('adds two defense dice and is discarded when the Campaign ends, either way', () => {
        const s = table({}, { defender: [STORM] })
        campaign().apply(s)
        const base = ongoingCampaign(s).defensePool
        defend([battlePlanUse(STORM)]).apply(s)
        expect(s.campaign?.defensePool).toBe(base + 2)
        expect(s.campaign?.discardAtEnd).toEqual([STORM])
        const piles = Object.values(s.discardPileCounts).reduce((n, c) => n + c, 0)
        finishCampaign(s)
        expect(s.campaign).toBeUndefined()
        expect(s.getPlayerState(DEFENDER).advisers.some((a) => a.cardId === STORM)).toBe(false)
        expect(Object.values(s.discardPileCounts).reduce((n, c) => n + c, 0)).toBe(piles + 1)
    })

    it('the bandits use it unasked when they rule its site (R-5.5.3, R-5.5.3-H1)', () => {
        const s = table({
            warbandsBySite: { c1: {}, p1: { [DEFENDER]: 3 } },
            denizensBySite: { c1: [STORM] }
        })
        const action = campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('c1')] })
        action.apply(s)
        expect(action.metadata?.battle?.plansUsed).toEqual([STORM])
        expect(s.campaign?.defensePool).toBe(1 + 2)
        finishCampaign(s)
        expect(s.denizensBySite.c1).toEqual([])
    })

    it('Specialist stops the bandits\' plans; a bandit Code of Honor stands alone', () => {
        const SPECIALIST = 'denizen.order.specialist'
        const locked = table({ warbandsBySite: { c1: {}, p1: { [DEFENDER]: 3 } }, denizensBySite: { c1: [STORM] } }, { attacker: [SPECIALIST] })
        const action = campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('c1')], plans: [battlePlanUse(SPECIALIST)] })
        action.apply(locked)
        expect(action.metadata?.battle?.plansUsed).toEqual([SPECIALIST])
        expect(locked.campaign?.defensePool).toBe(1)
        const honor = table({ warbandsBySite: { c1: {}, p1: { [DEFENDER]: 3 } }, denizensBySite: { c1: [STORM, 'denizen.order.code-of-honor'] } })
        const bandits = campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('c1')] })
        bandits.apply(honor)
        expect(bandits.metadata?.battle?.plansUsed).toEqual(['denizen.order.code-of-honor'])
    })

    it('Extra Provisions costs, so the bandits never use it', () => {
        const s = table({
            warbandsBySite: { c1: {}, p1: { [DEFENDER]: 3 } },
            denizensBySite: { c1: [PROVISIONS] }
        })
        const action = campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('c1')] })
        action.apply(s)
        expect(action.metadata?.battle?.plansUsed).toBeUndefined()
        expect(s.campaign?.defensePool).toBe(1)
    })
})

describe("the defender's allies use battle plans too (R-5.5.3.a)", () => {
    const CHANCELLOR = 'chancellor'
    const CITIZEN = 'citizen'

    function allyTable(advisers: { chancellor?: string[]; citizen?: string[] } = {}, seed = 1) {
        return testState(
            [
                testPlayer({
                    playerId: ATTACKER,
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'h1',
                    supply: 5,
                    favor: 3,
                    warbandsOnBoard: { [ATTACKER]: 5 },
                    warbandsInPersonalBank: { [ATTACKER]: 7 }
                }),
                testPlayer({
                    playerId: CHANCELLOR,
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'h1',
                    favor: 4,
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                    warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 15 },
                    advisers: (advisers.chancellor ?? []).map((cardId) => ({ cardId, faceUp: true }))
                }),
                testPlayer({
                    playerId: CITIZEN,
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'h1',
                    favor: 4,
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                    warbandsInPersonalBank: { [CITIZEN]: 9 },
                    advisers: (advisers.citizen ?? []).map((cardId) => ({ cardId, faceUp: true }))
                })
            ],
            {
                chancellorPlayerId: CHANCELLOR,
                warbandsBySite: { h1: { [IMPERIAL_WARBANDS]: 3 } },
                prng: { seed, invocations: 0 }
            }
        )
    }

    function attackEmpire(s: ReturnType<typeof allyTable>) {
        campaign({
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [siteTarget('h1')]
        }).apply(s)
        return joinDefence(s, CITIZEN, CHANCELLOR)
    }

    it('an ally with a usable plan holds the roll even when the defender has none', () => {
        const s = allyTable({ citizen: [PROVISIONS] })
        const action = attackEmpire(s)
        expect(s.campaign?.allyPlayerIds).toEqual([CITIZEN])
        expect(action.metadata?.battle?.awaitingDefender).toBe(true)
        expect(s.campaign?.pendingDefenderPlans?.queue).toEqual([CITIZEN])
        expect(s.prng.invocations).toBe(0)

        const handler = new CampaignPlansStateHandler()
        expect(handler.validActionsForPlayer(CITIZEN, machineContext(s))).toEqual([ActionType.CampaignDefend])
        expect(handler.validActionsForPlayer(CHANCELLOR, machineContext(s))).toEqual([])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, CHANCELLOR, [])).toMatch(/ally is answering/)
        expect(HydratedCampaignDefend.answeringPlayerId(s)).toBe(CITIZEN)

        const before = ongoingCampaign(s).defensePool
        const answer = defend([battlePlanUse(PROVISIONS)], CITIZEN)
        answer.apply(s)
        expect(s.campaign?.defensePool).toBe(before + 1)
        expect(s.campaign?.pendingDefenderPlans).toBeUndefined()
        expect(s.prng.invocations).toBeGreaterThan(0)
        expect(answer.metadata?.awaitingMore).toBeUndefined()
        expect(handler.onAction(answer, machineContext(s))).toBe(MachineState.CampaignSacrifice)
    })

    it('R-5.5.2.a then R-5.5.3 — with a Citizen to ask, the attacker declares plans only after the answers', () => {
        const ARCHERS = 'denizen.nomad.horse-archers'
        const s = allyTable({ citizen: [STORM] })
        s.getPlayerState(ATTACKER).addAdviser(ARCHERS, true)
        const declared = { defender: { kind: 'player' as const, playerId: CHANCELLOR }, targets: [siteTarget('h1')], attackDice: 1 }
        expect(HydratedCampaign.reasonCannotCampaign(s, ATTACKER, { ...declared, plans: [battlePlanUse(ARCHERS)] })).toMatch(/once the Citizens asked to join have answered/)
        campaign(declared).apply(s)
        expect(s.pendingCampaign?.awaitingAttackerPlans).toBeUndefined()
        joinDefence(s, CITIZEN, CHANCELLOR)
        expect(s.pendingCampaign?.awaitingAttackerPlans).toBe(true)
        expect(s.campaign).toBeUndefined()
        expect(new CampaignPlansStateHandler().validActionsForPlayer(ATTACKER, machineContext(s))).toEqual([ActionType.CampaignAttackPlans])
        expect(HydratedCampaignAttackPlans.reasonCannotDeclare(s, CITIZEN, [])).toMatch(/only the attacker/)

        new HydratedCampaignAttackPlans(buildAction(CampaignAttackPlans, { playerId: ATTACKER, plans: [battlePlanUse(ARCHERS)] })).apply(s)
        expect(s.pendingCampaign).toBeUndefined()
        expect(s.campaign?.allyPlayerIds).toEqual([CITIZEN])
        expect(s.campaign?.plansUsed).toContain(ARCHERS)
    })

    it('R-5.5.3 — a plan at an Imperial site used by the defender is not the ally\'s to use again', () => {
        const s = allyTable({ chancellor: [STORM], citizen: [STORM] })
        s.denizensBySite = { ...s.denizensBySite, h1: [PROVISIONS] }
        attackEmpire(s)
        defend([battlePlanUse(PROVISIONS)], CHANCELLOR).apply(s)
        expect(HydratedCampaignDefend.usablePlans(s, CITIZEN).map((p) => p.cardId)).not.toContain(PROVISIONS)
        expect(HydratedCampaignDefend.reasonCannotDefend(s, CITIZEN, [battlePlanUse(PROVISIONS)])).toMatch(/already used in this Campaign/)
    })

    it('the defender answers first, then each ally, and only the last answer rolls', () => {
        const s = allyTable({ chancellor: [PROVISIONS], citizen: [STORM] })
        attackEmpire(s)
        expect(s.campaign?.pendingDefenderPlans?.queue).toEqual([CHANCELLOR, CITIZEN])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, CITIZEN, [])).toMatch(/battle plans/)

        const handler = new CampaignPlansStateHandler()
        const first = defend([], CHANCELLOR)
        first.apply(s)
        expect(s.prng.invocations).toBe(0)
        expect(first.metadata?.awaitingMore).toEqual([CITIZEN])
        expect(s.campaign?.pendingDefenderPlans?.queue).toEqual([CITIZEN])
        expect(handler.onAction(first, machineContext(s))).toBe(MachineState.CampaignPlans)
        expect(HydratedCampaignDefend.reasonCannotDefend(s, CHANCELLOR, [])).toMatch(/ally is answering/)

        const pool = ongoingCampaign(s).defensePool
        const second = defend([battlePlanUse(STORM)], CITIZEN)
        second.apply(s)
        expect(s.campaign?.defensePool).toBe(pool + 2)
        expect(s.campaign?.plansUsed).toEqual([STORM])
        expect(s.prng.invocations).toBeGreaterThan(0)
        expect(handler.onAction(second, machineContext(s))).toBe(MachineState.CampaignSacrifice)
    })

    it('an ally with nothing usable is skipped, so a defender alone is as before', () => {
        const s = allyTable({ chancellor: [PROVISIONS] })
        attackEmpire(s)
        expect(s.campaign?.pendingDefenderPlans?.queue).toEqual([CHANCELLOR])
        const answer = defend([], CHANCELLOR)
        answer.apply(s)
        expect(s.campaign?.pendingDefenderPlans).toBeUndefined()
        expect(new CampaignPlansStateHandler().onAction(answer, machineContext(s))).toBe(
            MachineState.CampaignSacrifice
        )
    })
})
