import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    ActionType,
    Banner,
    Campaign,
    CampaignDefend,
    CampaignSacrifice,
    CampaignTargetKind,
    HydratedCampaignSacrifice,
    HydratedOathGameState,
    MachineState,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    Region,
    cardPowers,
    mapSlotsFor,
    type CampaignTarget
} from '@tabletop/oath'
import { required, served, testPlayer, testState, withChancellor } from '@tabletop/oath/testing'
import {
    canToggleTarget,
    campaignNeedsFlip,
    defenseSoFar,
    toggledTargets
} from './campaignDraft.js'
import { emptyPicks } from './powerChoices.js'
import { powerUseKey } from './powerUse.js'
import { campaignSteps } from '$lib/testing/campaignStepsTable.js'
import {
    disposeSessions,
    openSessionOn,
    played,
    tableOf,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

const ME = 'me'
const FOE = 'foe'
const HUNTER = 'denizen.order.relic-hunter'
const HUNTER_PLAN = {
    cardId: HUNTER,
    powerIndex: required(
        cardPowers(HUNTER).find((power) => power.timing === PowerTiming.BattlePlan),
        'Relic Hunter’s battle plan'
    ).powerIndex
}
const FOE_DEFENDS = { kind: 'player', playerId: FOE } as const
const SITE_C2: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'c2' }
const RELIC_AT_C2: CampaignTarget = { kind: CampaignTargetKind.SiteRelic, slotId: 'c2-r1' }

function board(foeSiteId = 'c1') {
    const state = testState(
        [
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { [ME]: 4 }
            }),
            testPlayer({
                playerId: FOE,
                color: Color.Yellow,
                siteId: foeSiteId,
                relicIds: ['relic.map']
            })
        ],
        {
            warbandsBySite: { c2: { [FOE]: 2 } },
            relicsBySite: { c2: [{ slotId: 'c2-r1' }] }
        }
    )
    state.banners[Banner.PeoplesFavor].holderPlayerId = FOE
    return state
}

describe('choosing targets', () => {
    it('a tap adds a target, and a second tap on an equal target removes it', () => {
        const once = toggledTargets([], SITE_C2)
        expect(once).toEqual([SITE_C2])
        expect(toggledTargets(once, { kind: CampaignTargetKind.Site, siteId: 'c2' })).toEqual([])
    })

    it('a relic is offered only when the defender stands at the attacker’s site', () => {
        const relic: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: 'relic.map' }
        const away = board('h1')
        away.warbandsBySite = { ...away.warbandsBySite, c1: { [FOE]: 1 } }
        expect(canToggleTarget(board('c1'), ME, FOE_DEFENDS, [], relic)).toBe(true)
        expect(canToggleTarget(away, ME, FOE_DEFENDS, [], relic)).toBe(false)
        const siteHere: CampaignTarget = { kind: CampaignTargetKind.Site, siteId: 'c1' }
        expect(canToggleTarget(away, ME, FOE_DEFENDS, [], siteHere)).toBe(true)
    })

    it('targeting The Hidden Place flips a secret (R-11.13)', () => {
        const state = board()
        state.siteCards = { ...state.siteCards, c2: 'site.the-hidden-place' }
        expect(campaignNeedsFlip(state, ME, FOE_DEFENDS, [SITE_C2])).toBe(true)
        expect(campaignNeedsFlip(board(), ME, FOE_DEFENDS, [SITE_C2])).toBe(false)
    })
})

afterEach(disposeSessions)

async function campaigning(warbands = 4, oathRevision?: OathRevision, advisers = [HUNTER]) {
    const state = board()
    if (oathRevision !== undefined) state.oathRevision = oathRevision
    state.players[0].warbandsOnBoard = { [ME]: warbands }
    state.players[0].advisers = advisers.map((cardId) => ({ cardId, faceUp: true }))
    state.players[0].adviserIds = advisers
    const session = await openSessionOn(tableOf(state))
    session.chooseAction(ActionType.Campaign)
    return session
}

/** Taps Next, which a test reaches only once the step's picks allow it. */
function next(draft: { nextShown: boolean; next(): void }) {
    expect(draft.nextShown).toBe(true)
    draft.next()
}

const BANDITS = { kind: 'bandits' } as const
// R-5.5.2 — a Campaign must target something at the attacker's own site first.
const FOES_RELIC: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: 'relic.map' }

/** The declaration one step at a time: Targets, Attack dice, Battle plans, then Declare. */
describe('the Campaign declared in three steps', () => {
    it('Next is offered once a target is picked, then once the dice are; Declare only on the last step', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.steps).toEqual(['targets', 'dice', 'plans'])
        expect(draft.step).toBe('targets')
        expect(draft.stepNumber).toBe(1)
        expect(draft.nextShown).toBe(false)
        expect(draft.declareShown).toBe(false)

        draft.toggleTarget(FOES_RELIC)
        expect(draft.nextShown).toBe(true)
        expect(draft.declareShown).toBe(false)
        draft.next()
        expect(draft.step).toBe('dice')
        expect(draft.stepNumber).toBe(2)
        expect(draft.nextShown).toBe(false)

        draft.setAttackDice(2)
        expect(draft.nextShown).toBe(true)
        expect(draft.declareShown).toBe(false)
        draft.next()
        expect(draft.step).toBe('plans')
        expect(draft.stepNumber).toBe(3)
        expect(draft.nextShown).toBe(false)
        expect(draft.declareShown).toBe(true)
    })

    it('each step takes only its own picks, and the map offers targets only on the first', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.setAttackDice(2)
        draft.declarePlan(HUNTER_PLAN, true)
        expect(draft.attackDice).toBeUndefined()
        expect(draft.plans).toEqual([])
        expect(draft.targetableSites).toEqual(['c2'])

        draft.toggleTarget(FOES_RELIC)
        next(draft)
        expect(draft.targetableSites).toEqual([])
        draft.toggleTarget(SITE_C2)
        expect(draft.targets).toEqual([FOES_RELIC])
        draft.declarePlan(HUNTER_PLAN, true)
        expect(draft.plans).toEqual([])

        draft.setAttackDice(2)
        next(draft)
        expect(draft.targetableSites).toEqual([])
        draft.setAttackDice(1)
        expect(draft.attackDice).toBe(2)
        draft.declarePlan(HUNTER_PLAN, true)
        expect(draft.plans).toEqual([HUNTER_PLAN])
    })

    it('a site on the map is pickable while its row would be listed, and a tap there toggles it (R-5.5.2)', async () => {
        const session = await campaigning(3)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        // The foe's c2 is not the attacker's site, so it waits for a target there.
        expect(session.siteOffers).toEqual([
            { slotId: 'c2', intent: 'target', targeted: false, pickable: false }
        ])
        draft.toggleSite('c2')
        expect(draft.targets).toEqual([])

        draft.toggleTarget(FOES_RELIC)
        expect(draft.isOfferedSite('c2')).toBe(true)
        draft.toggleSite('c2')
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2])
        expect(session.siteOffers).toEqual([
            { slotId: 'c2', intent: 'target', targeted: true, pickable: true }
        ])
        draft.toggleSite('c2')
        expect(draft.targets).toEqual([FOES_RELIC])

        draft.toggleSite('c2')
        next(draft)
        draft.toggleSite('c2')
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2])
    })

    it('Undo goes back one step with that step’s picks still marked; on Targets it takes the last target', async () => {
        const session = await campaigning(3)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        draft.toggleTarget(SITE_C2)
        next(draft)
        draft.setAttackDice(2)
        next(draft)
        draft.declarePlan(HUNTER_PLAN, true)

        await session.undo()
        expect(draft.step).toBe('dice')
        expect(draft.attackDice).toBe(2)
        expect(draft.plans).toEqual([])
        await session.undo()
        expect(draft.step).toBe('targets')
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2])
        expect(draft.attackDice).toBeUndefined()
        await session.undo()
        expect(draft.targets).toEqual([FOES_RELIC])
        await session.undo()
        expect(draft.targets).toEqual([])
        expect(draft.defender).toEqual(FOE_DEFENDS)
        await session.undo()
        expect(draft.defender).toBeUndefined()
        expect(session.selection.action).toBe(ActionType.Campaign)
    })

    it('a step with nothing to pick is skipped and not counted: no plans, Declare after the dice', async () => {
        const session = await campaigning(3, undefined, [])
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.planOptions).toEqual([])
        expect(draft.steps).toEqual(['targets', 'dice'])
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        expect(draft.step).toBe('dice')
        expect(draft.stepNumber).toBe(2)
        draft.setAttackDice(2)
        expect(draft.nextShown).toBe(false)
        expect(draft.declareShown).toBe(true)

        await session.undo()
        expect(draft.step).toBe('targets')
        expect(draft.targets).toEqual([FOES_RELIC])
    })

    it('with no warband to roll and no plan, Declare comes on the Targets step', async () => {
        const draft = (await campaigning(0, undefined, [])).campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.steps).toEqual(['targets'])
        draft.toggleTarget(FOES_RELIC)
        expect(draft.nextShown).toBe(false)
        expect(draft.attackDice).toBe(0)
        expect(draft.declareShown).toBe(true)
    })

    it('with no dice to choose, the plans follow the targets, and Undo goes back to the targets', async () => {
        const session = await campaigning(0)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.steps).toEqual(['targets', 'plans'])
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        expect(draft.step).toBe('plans')
        expect(draft.stepNumber).toBe(2)
        expect(draft.declareShown).toBe(true)
        await session.undo()
        expect(draft.step).toBe('targets')
        expect(draft.targets).toEqual([FOES_RELIC])
    })

    it('Declare sends exactly the three steps’ picks', async () => {
        const session = await campaigning(3)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        draft.toggleTarget(SITE_C2)
        next(draft)
        draft.setAttackDice(2)
        next(draft)
        draft.declarePlan(HUNTER_PLAN, true)
        const sent = vi.spyOn(session, 'declareCampaign').mockResolvedValue()
        await draft.declare()
        expect(sent).toHaveBeenCalledTimes(1)
        expect(sent.mock.calls[0][0]).toEqual({
            defender: FOE_DEFENDS,
            targets: [FOES_RELIC, SITE_C2],
            attackDice: 2,
            plans: [HUNTER_PLAN],
            flipSecret: false,
            skullLossOrder: undefined
        })
    })

    it('Declare sends nothing before the last step', async () => {
        const session = await campaigning(3)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(2)
        const sent = vi.spyOn(session, 'declareCampaign').mockResolvedValue()
        await draft.declare()
        expect(sent).not.toHaveBeenCalled()
    })

    it('Relic Hunter’s relic at a targeted site is a target before the plan is declared, and is refused without it', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        draft.toggleTarget(SITE_C2)
        expect(draft.targetOptions).toContainEqual(RELIC_AT_C2)
        draft.toggleTarget(RELIC_AT_C2)
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2, RELIC_AT_C2])
        next(draft)
        draft.setAttackDice(2)
        // The plan is a step later, so the dice step reads no refusal and offers Next.
        expect(draft.stoppedBecause).toBeUndefined()
        next(draft)
        expect(draft.stoppedBecause).toBe(draft.refusedBecause)
        expect(draft.refusedBecause).toBe(
            'a facedown relic at a site can be targeted only with Relic Hunter declared'
        )
        expect(draft.declareShown).toBe(false)

        draft.declarePlan(HUNTER_PLAN, true)
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2, RELIC_AT_C2])
        expect(draft.refusedBecause).toBeUndefined()
        expect(draft.declareShown).toBe(true)
        draft.declarePlan(HUNTER_PLAN, false)
        expect(draft.targets).toEqual([FOES_RELIC, SITE_C2, RELIC_AT_C2])
        expect(draft.declareShown).toBe(false)
    })
})

/** The five cases `docs/user-interactions.md` requires of each staged flow, for the Campaign draft. */
describe('the Campaign draft (docs/user-interactions.md)', () => {
    it('choosing the defender clears the plans, targets and dice chosen under the last one', async () => {
        const draft = (await campaigning()).campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(3)
        next(draft)
        draft.declarePlan(HUNTER_PLAN, true)
        expect(draft.targets).toEqual([FOES_RELIC])
        expect(draft.attackDice).toBe(3)
        expect(draft.plans).toEqual([HUNTER_PLAN])

        draft.chooseDefender(BANDITS)
        expect(draft.defender).toEqual(BANDITS)
        expect(draft.plans).toEqual([])
        expect(draft.targets).toEqual([])
        expect(draft.attackDice).toBeUndefined()
    })

    it('a pool of one die is taken for the player and is not a pick Undo returns to', async () => {
        const session = await campaigning(1)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.attackDice).toBe(1)
        await session.undo()
        expect(draft.defender).toBeUndefined()
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('a larger pool waits for the player to choose it', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.attackDice).toBeUndefined()
        expect(draft.complete).toBe(false)
    })

    it('a lone legal defender starts picked, and is not a pick Undo returns to', async () => {
        const state = board()
        // R-5.5.1 — the foe rules the attacker's site, so the bandits cannot be chosen.
        state.warbandsBySite = { ...state.warbandsBySite, c1: { [FOE]: 1 } }
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        expect(draft.defenderOptions).toEqual([FOE_DEFENDS])
        expect(draft.defender).toEqual(FOE_DEFENDS)
        expect(draft.hasManualSelection()).toBe(false)

        draft.toggleTarget({ kind: CampaignTargetKind.Site, siteId: 'c1' })
        expect(draft.targets).toHaveLength(1)
        await session.undo()
        expect(draft.targets).toEqual([])
        expect(draft.defender).toEqual(FOE_DEFENDS)
        expect(draft.hasManualSelection()).toBe(false)
    })

    it('two legal defenders wait for the player to pick one', async () => {
        const draft = (await campaigning()).campaign
        expect(draft.defenderOptions).toEqual([FOE_DEFENDS, BANDITS])
        expect(draft.defender).toBeUndefined()
    })

    it('Declare waits for a target and the dice, and no reason is read before then', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.complete).toBe(false)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        expect(draft.complete).toBe(false)
        expect(draft.refusedBecause).toBeUndefined()
        draft.setAttackDice(2)
        expect(draft.complete).toBe(true)
        expect(draft.refusedBecause).toBeUndefined()
    })

    it('R-5.5.2 — the pool runs to the warbands in the force, those at a site it reaches included', async () => {
        const state = board()
        state.warbandsBySite = { ...state.warbandsBySite, c2: { [ME]: 2, [FOE]: 2 } }
        state.players[0].campaignAsIf = { siteId: 'c2', atAction: state.actionCount }
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.maxDice).toBe(6)
        draft.toggleTarget(
            required(
                draft.targetOptions.find((t) => draft.canToggleTarget(t)),
                'a target'
            )
        )
        next(draft)
        draft.setAttackDice(6)
        expect(draft.attackDice).toBe(6)
    })

    it('R-5.5.2 — an empty pool may be chosen, even when one die was taken for the player', async () => {
        const draft = (await campaigning(3)).campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(0)
        expect(draft.attackDice).toBe(0)

        const single = (await campaigning(1)).campaign
        single.chooseDefender(FOE_DEFENDS)
        single.toggleTarget(FOES_RELIC)
        next(single)
        expect(single.attackDice).toBe(1)
        single.setAttackDice(0)
        expect(single.attackDice).toBe(0)
    })

    it('leaving the Campaign ends its draft', async () => {
        const session = await campaigning()
        session.campaign.chooseDefender(FOE_DEFENDS)
        session.chooseAction(ActionType.Travel)
        expect(session.campaign.open).toBe(false)
        session.chooseAction(ActionType.Campaign)
        expect(session.campaign.defender).toBeUndefined()
    })
})

// R-7.1.4-H2 — Sneak Attack's holder is asked as another player's Campaign ends.
function sneakAttackOffered(): PlayedTable {
    const state = testState(
        withChancellor([
            testPlayer({
                playerId: ME,
                color: Color.Red,
                siteId: 'c1',
                supply: 6,
                warbandsOnBoard: { [ME]: 6 }
            }),
            testPlayer({
                playerId: FOE,
                color: Color.Blue,
                siteId: 'c1',
                warbandsOnBoard: { [FOE]: 4 },
                advisers: [{ cardId: 'denizen.discord.sneak-attack', faceUp: true }]
            })
        ])
    )
    state.turnManager.series = [{ type: 'turn', playerId: ME, start: 0 }]
    const envelope = { gameId: state.gameId, source: ActionSource.User }
    const campaign = played(tableOf(state), [
        createAction(Campaign, {
            ...envelope,
            playerId: ME,
            defender: { kind: 'player', playerId: FOE },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 0,
            plans: []
        })
    ])
    const defended =
        campaign.state.machineState === MachineState.CampaignPlans
            ? played(campaign, [
                  createAction(CampaignDefend, { ...envelope, playerId: FOE, plans: [] })
              ])
            : campaign
    const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(
        new HydratedOathGameState(defended.state),
        0
    )
    return played(defended, [
        createAction(CampaignSacrifice, { ...envelope, playerId: ME, sacrifice: 0, defeatKills })
    ])
}

describe('the Campaign draft in a Sneak Attack', () => {
    it('the card names the defender, which Undo never returns to; Undo leaves for the question', async () => {
        const session = await openSessionOn(sneakAttackOffered())
        expect(session.myPlayer?.id).toBe(FOE)
        await session.question.accept()
        const draft = session.campaign
        expect(draft.defender).toEqual({ kind: 'player', playerId: ME })
        expect(draft.defenderFixed).toBe(true)
        expect(draft.hasManualSelection()).toBe(false)

        draft.toggleTarget({ kind: CampaignTargetKind.PawnAndFavor })
        expect(draft.hasManualSelection()).toBe(true)
        await session.undo()
        expect(draft.targets).toEqual([])
        expect(draft.defender).toEqual({ kind: 'player', playerId: ME })

        await session.undo()
        expect(session.selection.action).toBeUndefined()
        expect(draft.open).toBe(false)
    })
})

/** R-5.5.5, R-10.22 — before revision 7 the attacker orders where the skulls' kills come from. */
describe('the skull-loss order', () => {
    it('is asked only for a force of more than one kind, survives the dice, and is declared', async () => {
        const single = (await campaigning(3, OathRevision.UiBatch1)).campaign
        single.chooseDefender(FOE_DEFENDS)
        expect(single.lossSources).toHaveLength(1)

        const session = await campaigning(3, OathRevision.UiBatch1)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 3, [IMPERIAL_WARBANDS]: 1 }
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        const board = { kind: 'board', playerId: ME } as const
        expect(draft.lossOrder).toEqual([
            { at: board, owner: ME },
            { at: board, owner: IMPERIAL_WARBANDS }
        ])
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        // The loss order is asked on the Attack dice step, with the dice.
        draft.moveLossSourceUp(1)
        draft.setAttackDice(2)
        expect(draft.lossOrder.map((s) => s.owner)).toEqual([IMPERIAL_WARBANDS, ME])
        next(draft)

        const sent = vi.spyOn(session, 'declareCampaign').mockResolvedValue()
        await draft.declare()
        expect(sent).toHaveBeenCalledWith(
            expect.objectContaining({
                skullLossOrder: [
                    { at: board, owner: IMPERIAL_WARBANDS },
                    { at: board, owner: ME }
                ]
            })
        )
    })

    it('from revision 7 is not asked: the skulls’ losses are picked after the roll, and none is declared', async () => {
        const session = await campaigning(3, OathRevision.EngineFixes3)
        session.gameState.getPlayerState(ME).warbandsOnBoard = { [ME]: 3, [IMPERIAL_WARBANDS]: 1 }
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        expect(draft.lossSources).toEqual([])
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(2)
        next(draft)
        const sent = vi.spyOn(session, 'declareCampaign').mockResolvedValue()
        await draft.declare()
        expect(sent).toHaveBeenCalledWith(expect.objectContaining({ skullLossOrder: undefined }))
    })
})

describe('a battle plan whose text asks a choice (R-5.5.3)', () => {
    it('Mountain Giant is declared at ±1 unless its user picks ±3', async () => {
        const GIANT = 'denizen.nomad.mountain-giant'
        const state = board()
        state.players[0].advisers = [{ cardId: GIANT, faceUp: true }]
        state.players[0].adviserIds = [GIANT]
        state.players[0].secrets = 2
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(2)
        next(draft)
        const giant = required(
            draft.planOptions.find((p) => p.cardId === GIANT),
            'Mountain Giant’s plan'
        )
        draft.declarePlan(giant, true)
        expect(draft.planChoicesOf(giant)).toHaveLength(1)
        expect(draft.plans[0].choices).toEqual([])

        draft.setPlanPicks(giant, { ...emptyPicks(), option: { 0: 0 } })
        expect(draft.plans[0].choices).toEqual([{ kind: PowerChoiceKind.Yes }])
    })
})

describe('R-7.1.2 — the declared battle plans are judged together, as the engine pays them', () => {
    const ZEALOTS = 'denizen.discord.zealots'
    const SLANDER = 'denizen.discord.slander'
    const planOf = (cardId: string) => ({
        cardId,
        powerIndex: required(
            cardPowers(cardId).find((power) => power.timing === PowerTiming.BattlePlan),
            `${cardId}’s battle plan`
        ).powerIndex
    })

    /** `me` rules Zealots and Slander, a favor each, and holds one favor. */
    async function twoPlans(oathRevision: OathRevision) {
        const state = board()
        state.oathRevision = oathRevision
        state.players[0].favor = 1
        state.players[0].advisers = [ZEALOTS, SLANDER].map((cardId) => ({ cardId, faceUp: true }))
        state.players[0].adviserIds = [ZEALOTS, SLANDER]
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        draft.setAttackDice(2)
        next(draft)
        return draft
    }

    it('two plans the one favor cannot both pay are refused with the total, and one alone may be declared', async () => {
        const draft = await twoPlans(OathRevision.PlanCostsAndSearchPlays)
        draft.declarePlan(planOf(ZEALOTS), true)
        expect(draft.refusedBecause).toBeUndefined()
        expect(draft.complete).toBe(true)

        draft.declarePlan(planOf(SLANDER), true)
        expect(draft.complete).toBe(true)
        expect(draft.refusedBecause).toBe('your battle plans cost 2 favor in all, you hold 1')
    })

    it('a refusal is read only once the declaration is complete: not before the dice', async () => {
        const state = board()
        state.oathRevision = OathRevision.PlanCostsAndSearchPlays
        state.players[0].favor = 1
        state.players[0].warbandsOnBoard = { [ME]: 3 }
        state.players[0].advisers = [ZEALOTS, SLANDER].map((cardId) => ({ cardId, faceUp: true }))
        state.players[0].adviserIds = [ZEALOTS, SLANDER]
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        draft.toggleTarget(FOES_RELIC)
        next(draft)
        expect(draft.complete).toBe(false)
        expect(draft.refusedBecause).toBeUndefined()

        draft.setAttackDice(2)
        next(draft)
        draft.declarePlan(planOf(ZEALOTS), true)
        draft.declarePlan(planOf(SLANDER), true)
        expect(draft.refusedBecause).toBe('your battle plans cost 2 favor in all, you hold 1')
        expect(draft.declareShown).toBe(false)
    })

    it('R-X.4 — before revision 3 each plan is judged alone, so both may be declared', async () => {
        const draft = await twoPlans(OathRevision.CostsAndFacedownModifiers)
        draft.declarePlan(planOf(ZEALOTS), true)
        draft.declarePlan(planOf(SLANDER), true)
        expect(draft.refusedBecause).toBeUndefined()
        expect(draft.complete).toBe(true)
    })
})

describe('R-5.5.1.a — a Citizen attacking the Chancellor is offered nothing through the Empire’s sites', () => {
    const HORSE_ARCHERS = 'denizen.nomad.horse-archers'
    const VOW_OF_UNION = 'denizen.beast.vow-of-union'

    /** `me`, a Citizen with Vow of Union, attacks the Chancellor; the Empire alone holds c1 and c2. */
    async function citizenAttacks(oathRevision: OathRevision) {
        const state = testState(
            [
                testPlayer({
                    playerId: ME,
                    color: Color.Red,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1',
                    warbandsOnBoard: { [ME]: 4 },
                    advisers: [{ cardId: VOW_OF_UNION, faceUp: true }]
                }),
                testPlayer({
                    playerId: FOE,
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'c1',
                    warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 }
                })
            ],
            {
                oathRevision,
                denizensBySite: { c1: [], c2: [HORSE_ARCHERS], p1: [], h1: [] },
                warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [IMPERIAL_WARBANDS]: 2 } }
            }
        )
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        draft.chooseDefender(FOE_DEFENDS)
        return draft
    }

    it('lists no plan at a site only the Empire rules, and counts none of its warbands', async () => {
        const draft = await citizenAttacks(OathRevision.EngineFixes2)
        expect(draft.planOptions.map((p) => p.cardId)).not.toContain(HORSE_ARCHERS)
        expect(draft.maxDice).toBe(4)
        expect(draft.lossSources).toEqual([{ at: { kind: 'board', playerId: ME }, owner: ME }])
    })

    it('R-X.4 — before revision 5 the Empire’s sites were shared', async () => {
        const draft = await citizenAttacks(OathRevision.CardFixes1)
        expect(draft.planOptions.map((p) => p.cardId)).toContain(HORSE_ARCHERS)
        expect(draft.maxDice).toBe(7)
    })
})

/**
 * R-5.5.2, R-5.5.4 — the defense the declaration gives so far: one die per targeted site, a relic's
 * printed dice, a banner's tokens and two for the pawn; the defender's warbands at the targeted
 * sites, and on their board when their pawn is in the battle. Allies and the defender's own plans
 * come later, hence "so far".
 */
describe('the defense so far', () => {
    const [PLAINS, RIVER] = mapSlotsFor(Region.Provinces)
    const ANN = { kind: 'player', playerId: 'Ann' } as const
    const site = (siteId: string): CampaignTarget => ({ kind: CampaignTargetKind.Site, siteId })
    const CUP: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: 'relic.cup-of-plenty' }
    const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
    const warbands = (count: number) => ({ count, noun: 'warband' })
    const bandits = (count: number) => ({ count, noun: 'bandit' })

    /** The sheet's scene: Dana campaigns from the Plains against Ann, whose pawn is there too. */
    async function againstAnn() {
        const session = await openSessionOn(campaignSteps())
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        expect(draft.defender).toEqual(ANN)
        return { session, draft }
    }

    it('is counted from the first step and recounted as targets are added and dropped', async () => {
        const { draft } = await againstAnn()
        // Ann's pawn stands at Dana's site, so the three warbands on Ann's board defend already.
        expect(draft.defenseSoFar).toEqual({ dice: 0, counts: [warbands(3)] })

        draft.toggleTarget(site(PLAINS))
        expect(draft.defenseSoFar).toEqual({ dice: 1, counts: [warbands(5)] })
        draft.toggleTarget(site(RIVER))
        expect(draft.defenseSoFar).toEqual({ dice: 2, counts: [warbands(6)] })
        draft.toggleTarget(CUP)
        expect(draft.defenseSoFar).toEqual({ dice: 4, counts: [warbands(6)] })
        draft.toggleTarget(PAWN)
        expect(draft.defenseSoFar).toEqual({ dice: 6, counts: [warbands(6)] })

        draft.toggleTarget(site(RIVER))
        expect(draft.defenseSoFar).toEqual({ dice: 5, counts: [warbands(5)] })
        draft.toggleTarget(site(RIVER))
        expect(draft.defenseSoFar).toEqual({ dice: 6, counts: [warbands(6)] })
    })

    it('holds through the dice and the battle plans, and Undo back to the targets recounts', async () => {
        const { session, draft } = await againstAnn()
        for (const target of [site(PLAINS), site(RIVER), CUP, PAWN]) draft.toggleTarget(target)
        const sixAndSix = { dice: 6, counts: [warbands(6)] }

        next(draft)
        expect(draft.step).toBe('dice')
        expect(draft.defenseSoFar).toEqual(sixAndSix)
        draft.setAttackDice(3)
        next(draft)
        expect(draft.step).toBe('plans')
        expect(draft.defenseSoFar).toEqual(sixAndSix)
        // An attacker's plan only adds attack dice; the defender's plans come after the declaration.
        expect(draft.planOptions).toHaveLength(2)
        for (const power of draft.planOptions) {
            draft.declarePlan(powerUseKey(power), true)
            expect(draft.isPlanDeclared(powerUseKey(power))).toBe(true)
            expect(draft.defenseSoFar).toEqual(sixAndSix)
        }

        for (let undone = 0; undone < 6 && draft.step !== 'targets'; undone++) {
            await session.undo()
        }
        expect(draft.step).toBe('targets')
        expect(draft.targets).toHaveLength(4)
        expect(draft.defenseSoFar).toEqual(sixAndSix)
        draft.toggleTarget(PAWN)
        expect(draft.defenseSoFar).toEqual({ dice: 4, counts: [warbands(6)] })
    })

    it('against the bandits, they are named and warbands are not: bandits are not warbands (R-10.3)', async () => {
        const draft = (await campaigning()).campaign
        draft.chooseDefender(BANDITS)
        expect(draft.defenseSoFar).toEqual({ dice: 0, counts: [bandits(0)] })
        draft.toggleTarget(site('c1'))
        expect(draft.targets).toEqual([site('c1')])
        expect(draft.defenseSoFar).toEqual({ dice: 1, counts: [bandits(1)] })
    })

    it('bandits serving a defending player are named after their warbands (R-7.6.5)', async () => {
        const state = board()
        // Bandit Crown: the foe rules the empty sites, the attacker's c1 among them.
        state.getPlayerState(FOE).relicIds = ['relic.map', 'relic.bandit-crown']
        const session = await openSessionOn(tableOf(state))
        session.chooseAction(ActionType.Campaign)
        const draft = session.campaign
        expect(draft.defender).toEqual(FOE_DEFENDS)
        expect(draft.defenseSoFar).toEqual({ dice: 0, counts: [warbands(0)] })

        draft.toggleTarget(site('c1'))
        expect(draft.targets).toEqual([site('c1')])
        expect(draft.defenseSoFar).toEqual({ dice: 1, counts: [warbands(0), bandits(1)] })
    })

    it('is nothing before the defender is chosen', async () => {
        const draft = (await campaigning()).campaign
        expect(draft.defender).toBeUndefined()
        expect(draft.defenseSoFar).toBeUndefined()
    })

    it('reads the same on the attacker’s own view as on the server’s: a facedown adviser is not counted', () => {
        const SEALING_WARD = 'denizen.arcane.sealing-ward'
        const targets = [site(PLAINS), site(RIVER), CUP, PAWN]
        const withWard = (faceUp: boolean) => {
            const host = new HydratedOathGameState(campaignSteps().state)
            host.getPlayerState('Ann').setAdvisers([{ cardId: SEALING_WARD, faceUp }])
            const view = new HydratedOathGameState(
                served(host, { kind: 'player', playerId: 'Dana' })
            )
            return [host, view].map((state) => defenseSoFar(state, 'Dana', ANN, targets))
        }

        // Sealing Ward: "Your relics add one more defense die when targeted", once it is faceup.
        const [hiddenOnHost, hiddenInView] = withWard(false)
        expect(hiddenInView).toEqual(hiddenOnHost)
        expect(hiddenInView).toEqual({ dice: 6, counts: [warbands(6)] })
        const [shownOnHost, shownInView] = withWard(true)
        expect(shownInView).toEqual(shownOnHost)
        expect(shownInView).toEqual({ dice: 7, counts: [warbands(6)] })
    })
})
