import { assertExists } from '@tabletop/common'
import {
    BattlePlanSide,
    CampaignTargetKind,
    HydratedCampaign,
    OathRevision,
    attackingForceSources,
    isAtLeastOathRevision,
    campaignTargetOptions,
    collectDefendingBandits,
    collectDefendingForce,
    collectDefensePool,
    forceSitesOf,
    forceTotal,
    reasonCannotDeclareTargets,
    targetsNeedFlip,
    usableBattlePlans,
    type BattlePlanUse,
    type CampaignDefender,
    type CampaignParties,
    type CampaignTarget,
    type CardPower,
    type HydratedOathGameState,
    type LegalChoice,
    type LossSource,
    type PowerUseKey,
    sameLossSource
} from '@tabletop/oath'
import { campaignDraftOpens } from './campaignTurn.js'
import type { DefenseCount } from './names.js'
import { samePowerUse } from './powerUse.js'
import { declaredPlan, listedPlans, planChoices } from './planChoices.js'
import { emptyPicks, picksComplete, type PowerChoicePicks } from './powerChoices.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'

export function sameTarget(a: CampaignTarget, b: CampaignTarget): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

export function sameDefender(a: CampaignDefender, b: CampaignDefender): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

/** R-5.5.3, R-7.5.1 — R-5.5.1.a's scope depends on the defender. */
export function attackerPlans(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender
): CardPower[] {
    return usableBattlePlans(
        state,
        playerId,
        BattlePlanSide.Attacker,
        partiesOf(state, playerId, defender, [])
    )
}

function partiesOf(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
): CampaignParties {
    return HydratedCampaign.partiesFor(state, playerId, { defender, targets })
}

export function reasonCampaignTargetsInvalid(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
): string | undefined {
    return reasonCannotDeclareTargets(state, partiesOf(state, playerId, defender, targets))
}

export function toggledTargets(
    targets: readonly CampaignTarget[],
    target: CampaignTarget
): CampaignTarget[] {
    return targets.some((t) => sameTarget(t, target))
        ? targets.filter((t) => !sameTarget(t, target))
        : [...targets, target]
}

/** R-5.5.2 constrains the set as a whole, so a candidate is offered when the set with it is legal. */
export function canToggleTarget(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender,
    targets: readonly CampaignTarget[],
    target: CampaignTarget
): boolean {
    const next = toggledTargets(targets, target)
    return (
        next.length === 0 ||
        reasonCampaignTargetsInvalid(state, playerId, defender, next) === undefined
    )
}

/** R-11.13 — targeting The Hidden Place costs a flipped secret. */
export function campaignNeedsFlip(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
): boolean {
    return targetsNeedFlip(state, partiesOf(state, playerId, defender, targets))
}

/** The defense dice the targets give, and what defends with them, counted in words. */
export interface DefenseSoFar {
    dice: number
    counts: DefenseCount[]
}

/**
 * R-5.5.2, R-5.5.4 — the defense the declaration gives so far, as the battle will count it: the
 * targets' dice and the defending force. The allies who answer, the defender's battle plans and a
 * targeted Mountain's die come later. R-10.3 — bandits are not warbands: against the bandits only
 * they are named; beside a defending player's warbands, only when some serve them (R-7.6.5).
 */
export function defenseSoFar(
    state: HydratedOathGameState,
    playerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
): DefenseSoFar {
    const parties = partiesOf(state, playerId, defender, targets)
    const bandits: DefenseCount = { count: collectDefendingBandits(state, parties), noun: 'bandit' }
    const warbands: DefenseCount = {
        count: forceTotal(collectDefendingForce(state, parties)),
        noun: 'warband'
    }
    return {
        dice: collectDefensePool(state, parties),
        counts:
            defender.kind === 'bandits'
                ? [bandits]
                : bandits.count > 0
                  ? [warbands, bandits]
                  : [warbands]
    }
}

/** A declared plan and the picks its text asks for. */
type StagedPlan = PowerUseKey & { picks?: PowerChoicePicks }

/**
 * The steps' picks in the steps' order, each step closed by its Next (`targetsTaken`, `diceTaken`),
 * so Undo returns to a step with its picks still marked, and a step's picks clear the later ones.
 */
type CampaignValueByStage = {
    defender: CampaignDefender
    targets: CampaignTarget[]
    targetsTaken: true
    dice: number
    lossOrder: LossSource[]
    diceTaken: true
    plans: StagedPlan[]
}

const CAMPAIGN_STAGE_ORDER = [
    'defender',
    'targets',
    'targetsTaken',
    'dice',
    'lossOrder',
    'diceTaken',
    'plans'
] as const
const _campaignStagesAreCovered: StagesCover<CampaignValueByStage, typeof CAMPAIGN_STAGE_ORDER> =
    true
void _campaignStagesAreCovered

/** The declaration's steps, in the order they are shown; one with nothing to pick is left out. */
export type CampaignStep = 'targets' | 'dice' | 'plans'

// The stage a step's Next sets; the last step shown has Declare instead.
const STEP_TAKEN = { targets: 'targetsTaken', dice: 'diceTaken' } as const

export type CampaignDeclaration = {
    defender: CampaignDefender
    targets: CampaignTarget[]
    attackDice: number
    plans: BattlePlanUse[]
    flipSecret: boolean
    skullLossOrder: LossSource[] | undefined
}

/**
 * R-5.5.1 to R-5.5.3 — the attacker's declaration: the defender, then one step at a time the
 * targets, the attack dice and the battle plans, then Declare.
 */
export class CampaignDraft implements PanelDraft {
    private flow = new StagedFlow<CampaignValueByStage>(CAMPAIGN_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        return playerId !== undefined &&
            campaignDraftOpens(this.session.selection.action, this.session.validActionTypes)
            ? playerId
            : undefined
    }

    get open(): boolean {
        return this.playerId !== undefined
    }

    // Sneak Attack names the defender, or the rules allow only one: either way it is never a pick.
    get defenderFixed(): boolean {
        return this.open && this.flow.sourceOf('defender') === 'auto'
    }

    /** What the rules leave no choice over is taken for the player when the Campaign is chosen. */
    begin(): void {
        const named = this.session.sneakAttackDefenderId
        const [lone, ...others] = this.defenderOptions
        if (named !== undefined) {
            this.flow.autoSelect('defender', { kind: 'player', playerId: named })
        } else if (lone !== undefined && others.length === 0) {
            this.flow.autoSelect('defender', lone)
        }
    }

    get supplyCost(): number {
        const playerId = this.playerId
        return playerId ? HydratedCampaign.supplyCostFor(this.session.gameState, playerId) : 0
    }

    get defenderOptions(): CampaignDefender[] {
        const playerId = this.playerId
        return playerId ? HydratedCampaign.legalDefenders(this.session.gameState, playerId) : []
    }

    get defender(): CampaignDefender | undefined {
        const chosen = this.flow.value('defender')
        return chosen !== undefined && this.defenderOptions.some((d) => sameDefender(d, chosen))
            ? chosen
            : undefined
    }

    chooseDefender(defender: CampaignDefender): void {
        if (this.defenderFixed || !this.defenderOptions.some((d) => sameDefender(d, defender))) {
            return
        }
        this.flow.set('defender', defender)
    }

    /** The steps shown: the targets always; the dice with a warband to roll; the plans with one to declare. */
    get steps(): CampaignStep[] {
        if (!this.defender) return []
        const steps: CampaignStep[] = ['targets']
        if (this.maxDice > 0) steps.push('dice')
        if (this.planOptions.length > 0) steps.push('plans')
        return steps
    }

    /** The first step whose Next is not taken; the last one shown has Declare instead. */
    get step(): CampaignStep | undefined {
        const steps = this.steps
        return (
            steps.find((step) => step === 'plans' || !this.flow.value(STEP_TAKEN[step])) ??
            steps.at(-1)
        )
    }

    /** From 1; 0 before the defender is chosen. */
    get stepNumber(): number {
        const step = this.step
        return step === undefined ? 0 : this.steps.indexOf(step) + 1
    }

    private get onLastStep(): boolean {
        const step = this.step
        return step !== undefined && step === this.steps.at(-1)
    }

    /** Next, once the step's picks are what the single panel checked before Declare. */
    get nextShown(): boolean {
        if (this.onLastStep) return false
        switch (this.step) {
            case 'targets':
                return this.targets.length > 0 && this.targetsRefusedBecause === undefined
            case 'dice':
                return this.attackDice !== undefined
            default:
                return false
        }
    }

    /**
     * The reason that takes the confirm's place: on the last step, why the engine refuses the
     * declaration; before it, on the Targets step, why the targets cannot be declared. A later
     * step can still answer a refusal (Relic Hunter's relic waits for its plan), so none is read
     * on the steps between.
     */
    get stoppedBecause(): string | undefined {
        return this.onLastStep ? this.refusedBecause : this.targetsRefusedBecause
    }

    private get targetsRefusedBecause(): string | undefined {
        const playerId = this.playerId
        const defender = this.defender
        const targets = this.targets
        if (!playerId || !defender || targets.length === 0 || this.step !== 'targets') {
            return undefined
        }
        return reasonCampaignTargetsInvalid(this.session.gameState, playerId, defender, targets)
    }

    next(): void {
        const step = this.step
        if (!this.nextShown || step === undefined || step === 'plans') return
        this.flow.set(STEP_TAKEN[step], true)
    }

    /** Declare, on the last step, once the declaration is complete and the engine would take it. */
    get declareShown(): boolean {
        return this.onLastStep && this.complete && this.refusedBecause === undefined
    }

    /** R-5.5.2.a then R-5.5.3 — with Citizens to ask, the plans are declared after their answers. */
    get plansWaitForAllies(): boolean {
        const playerId = this.playerId
        const defender = this.defender
        if (!playerId || !defender) return false
        const state = this.session.gameState
        const parties = HydratedCampaign.partiesFor(state, playerId, {
            defender,
            targets: this.flow.value('targets') ?? []
        })
        return HydratedCampaign.optionalAllies(state, parties).length > 0
    }

    get planOptions(): CardPower[] {
        const playerId = this.playerId
        const defender = this.defender
        const state = this.session.gameState
        return playerId && defender && !this.plansWaitForAllies
            ? listedPlans(state, playerId, attackerPlans(state, playerId, defender))
            : []
    }

    get plans(): BattlePlanUse[] {
        const playerId = this.playerId
        if (!playerId) return []
        return (this.flow.value('plans') ?? []).flatMap((staged) => {
            const power = this.planOptions.find((p) => samePowerUse(p, staged))
            return power
                ? [declaredPlan(this.session.gameState, playerId, power, staged.picks)]
                : []
        })
    }

    /** R-5.5.3 — the choices a declared plan's text opens. */
    planChoicesOf(power: CardPower): LegalChoice[] {
        const playerId = this.playerId
        return playerId && this.isPlanDeclared(power)
            ? planChoices(this.session.gameState, playerId, power)
            : []
    }

    planPicksOf(use: PowerUseKey): PowerChoicePicks {
        return (
            (this.flow.value('plans') ?? []).find((p) => samePowerUse(p, use))?.picks ??
            emptyPicks()
        )
    }

    setPlanPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        if (this.step !== 'plans' || !this.isPlanDeclared(use)) return
        const staged = (this.flow.value('plans') ?? []).map((p) =>
            samePowerUse(p, use) ? { cardId: p.cardId, powerIndex: p.powerIndex, picks } : p
        )
        this.flow.set('plans', staged)
    }

    isPlanDeclared(use: PowerUseKey): boolean {
        return this.plans.some((p) => samePowerUse(p, use))
    }

    declarePlan(use: PowerUseKey, on: boolean): void {
        const offered = this.planOptions.some((p) => samePowerUse(p, use))
        if (this.step !== 'plans' || !offered) return
        const staged = (this.flow.value('plans') ?? []).filter(
            (p) => !samePowerUse(p, use) && this.planOptions.some((o) => samePowerUse(o, p))
        )
        this.flow.set(
            'plans',
            on ? [...staged, { cardId: use.cardId, powerIndex: use.powerIndex }] : staged
        )
    }

    get targetOptions(): CampaignTarget[] {
        const defender = this.defender
        const playerId = this.playerId
        if (!defender || !playerId) return []
        // Relic Hunter's target is picked before its plan, which comes a step later or after the
        // allies answer; the engine refuses the relic if the plan is not declared with it.
        return campaignTargetOptions(
            this.session.gameState,
            defender,
            attackerPlans(this.session.gameState, playerId, defender),
            this.flow.value('targets') ?? []
        )
    }

    get targets(): CampaignTarget[] {
        const options = this.targetOptions
        return (this.flow.value('targets') ?? []).filter((t) =>
            options.some((o) => sameTarget(o, t))
        )
    }

    /** On every step, from the targets picked; nothing before the defender is chosen. */
    get defenseSoFar(): DefenseSoFar | undefined {
        const playerId = this.playerId
        const defender = this.defender
        if (!playerId || !defender) return undefined
        return defenseSoFar(this.session.gameState, playerId, defender, this.targets)
    }

    hasTarget(target: CampaignTarget): boolean {
        return this.targets.some((t) => sameTarget(t, target))
    }

    canToggleTarget(target: CampaignTarget): boolean {
        const defender = this.defender
        assertExists(defender, 'A target is offered only once the defender is chosen')
        const playerId = this.playerId
        assertExists(playerId, 'A defender is chosen only from the live seat')
        return canToggleTarget(this.session.gameState, playerId, defender, this.targets, target)
    }

    /** R-5.5.2 — a target the rules refuse with what is chosen is not offered until it can be. */
    isOffered(target: CampaignTarget): boolean {
        return this.hasTarget(target) || this.canToggleTarget(target)
    }

    // The board's site layer toggles targets too, so a tap off the Targets step is refused here.
    toggleTarget(target: CampaignTarget): void {
        if (this.step !== 'targets') return
        if (!this.isOffered(target)) return
        this.flow.set('targets', toggledTargets(this.targets, target))
    }

    // Lit on the map only on the Targets step.
    get targetableSites(): string[] {
        if (this.step !== 'targets') return []
        return this.targetOptions.flatMap((target) =>
            target.kind === CampaignTargetKind.Site ? [target.siteId] : []
        )
    }

    isTargetedSite(siteId: string): boolean {
        return this.hasTarget({ kind: CampaignTargetKind.Site, siteId })
    }

    /** A lit site the Sites rows would list now: on a phone the map is those rows. */
    isOfferedSite(siteId: string): boolean {
        return this.isOffered({ kind: CampaignTargetKind.Site, siteId })
    }

    /** A tap on a lit site, where the map stands in for the Sites rows. */
    toggleSite(siteId: string): void {
        this.toggleTarget({ kind: CampaignTargetKind.Site, siteId })
    }

    // R-5.5.2 — one attack die per warband in the force.
    get maxDice(): number {
        const playerId = this.playerId
        const defender = this.defender
        if (!playerId || !defender) return 0
        const state = this.session.gameState
        return HydratedCampaign.maxAttackDice(state, partiesOf(state, playerId, defender, []))
    }

    // One possible pool (none or one die) is taken for the player; any other waits for their tap.
    get attackDice(): number | undefined {
        const chosen = this.flow.value('dice')
        if (chosen !== undefined) return this.clampDice(chosen)
        return this.defender !== undefined && this.maxDice <= 1 ? this.maxDice : undefined
    }

    setAttackDice(count: number): void {
        if (this.step !== 'dice') return
        this.keepingLossOrder(() => this.flow.set('dice', this.clampDice(count)))
    }

    /**
     * R-5.5.5, R-10.22 — where the skulls' kills come from, asked when the force holds more than one kind.
     * From revision 7 they are picked after the roll instead (R-X.4).
     */
    get lossSources(): LossSource[] {
        const playerId = this.playerId
        const defender = this.defender
        const state = this.session.gameState
        if (!playerId || !defender || isAtLeastOathRevision(state, OathRevision.EngineFixes3)) {
            return []
        }
        return attackingForceSources(
            state,
            partiesOf(state, playerId, defender, []),
            forceSitesOf(state, playerId)
        )
    }

    // The engine's order is shown until the player moves a source.
    get lossOrder(): LossSource[] {
        const sources = this.lossSources
        const stored = this.flow.value('lossOrder')
        const valid =
            stored !== undefined &&
            stored.length === sources.length &&
            sources.every((source) => stored.some((s) => sameLossSource(s, source)))
        return valid ? stored : sources
    }

    moveLossSourceUp(index: number): void {
        const order = this.lossOrder
        if (this.step !== 'dice' || index <= 0 || index >= order.length) return
        const moved = [...order]
        ;[moved[index - 1], moved[index]] = [moved[index], moved[index - 1]]
        this.flow.set('lossOrder', moved)
    }

    /** What `declare` sends, once the defender, a target and the dice are chosen. */
    private get declaration(): CampaignDeclaration | undefined {
        const playerId = this.playerId
        const defender = this.defender
        const attackDice = this.attackDice
        const targets = this.targets
        if (!playerId || !defender || attackDice === undefined || targets.length === 0) {
            return undefined
        }
        return {
            defender,
            targets,
            attackDice,
            plans: this.plans,
            flipSecret: campaignNeedsFlip(this.session.gameState, playerId, defender, targets),
            skullLossOrder: this.lossSources.length > 1 ? this.lossOrder : undefined
        }
    }

    /** A defender, a target and the dice are picked, and every declared plan has its picks. */
    get complete(): boolean {
        return (
            this.declaration !== undefined &&
            this.planOptions
                .filter((power) => this.isPlanDeclared(power))
                .every((power) => picksComplete(this.planChoicesOf(power), this.planPicksOf(power)))
        )
    }

    /** Why the engine refuses the declaration as picked, read only once it is complete. */
    get refusedBecause(): string | undefined {
        const playerId = this.playerId
        const declaration = this.declaration
        if (!playerId || !declaration || !this.complete) return undefined
        const state = this.session.gameState
        const { defender, targets } = declaration
        // R-7.1.2 — the declared plans are paid from one holding, so the engine judges them together.
        return (
            reasonCampaignTargetsInvalid(state, playerId, defender, targets) ??
            HydratedCampaign.reasonCannotCampaign(state, playerId, declaration)
        )
    }

    async declare(): Promise<void> {
        const declaration = this.declaration
        if (!declaration || !this.declareShown) return
        await this.session.declareCampaign(declaration)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    // Undo goes back a step, whose picks are still marked; on the Targets step it takes one target
    // at a time, the last one chosen first, then the defender.
    back(): boolean {
        const steps = this.steps
        const step = this.step
        const index = step === undefined ? -1 : steps.indexOf(step)
        const before = index > 0 ? steps[index - 1] : undefined
        if (before !== undefined && before !== 'plans') {
            this.flow.clearFrom(STEP_TAKEN[before])
            return true
        }
        if (this.flow.highestManualStage() === 'targets' && this.targets.length > 1) {
            this.flow.set('targets', this.targets.slice(0, -1))
            return true
        }
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }

    // R-5.5.2 — "up to", so an empty pool is a choice.
    private clampDice(count: number): number {
        return Math.max(0, Math.min(count, this.maxDice))
    }

    // The loss order does not depend on the dice, so a change to those keeps it; it is read back
    // only while it names the force's sources.
    private keepingLossOrder(change: () => void): void {
        const order = this.flow.value('lossOrder')
        const source = this.flow.sourceOf('lossOrder')
        change()
        if (order !== undefined && source !== undefined) this.flow.set('lossOrder', order, source)
    }
}
