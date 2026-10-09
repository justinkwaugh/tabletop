import { assertExists } from '@tabletop/common'
import {
    BattlePlanSide,
    CampaignTargetKind,
    HydratedCampaign,
    attackingForceSources,
    campaignTargetOptions,
    forceSitesOf,
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
import { samePowerUse } from './powerUse.js'
import { declaredPlan, planChoices } from './planChoices.js'
import { emptyPicks, type PowerChoicePicks } from './powerChoices.js'
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

/** A declared plan and the picks its text asks for. */
type StagedPlan = PowerUseKey & { picks?: PowerChoicePicks }

type CampaignValueByStage = {
    defender: CampaignDefender
    plans: StagedPlan[]
    targets: CampaignTarget[]
    dice: number
    lossOrder: LossSource[]
}

const CAMPAIGN_STAGE_ORDER = ['defender', 'plans', 'targets', 'dice', 'lossOrder'] as const
const _campaignStagesAreCovered: StagesCover<CampaignValueByStage, typeof CAMPAIGN_STAGE_ORDER> =
    true
void _campaignStagesAreCovered

export type CampaignDeclaration = {
    defender: CampaignDefender
    targets: CampaignTarget[]
    attackDice: number
    plans: BattlePlanUse[]
    flipSecret: boolean
    skullLossOrder: LossSource[] | undefined
}

/** R-5.5.1 to R-5.5.3 — the attacker's declaration, staged: defender, battle plans, targets, attack dice. */
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

    // Sneak Attack — the card names the defender, so it is never a pick.
    get defenderFixed(): boolean {
        return this.open && this.flow.sourceOf('defender') === 'auto'
    }

    /** What the rules leave no choice over is taken for the player when the Campaign is chosen. */
    begin(): void {
        const named = this.session.sneakAttackDefenderId
        if (named !== undefined)
            this.flow.autoSelect('defender', { kind: 'player', playerId: named })
        this.autoSelectDice()
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
        this.autoSelectDice()
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
        return playerId && defender && !this.plansWaitForAllies
            ? attackerPlans(this.session.gameState, playerId, defender)
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
        if (!this.isPlanDeclared(use)) return
        const staged = (this.flow.value('plans') ?? []).map((p) =>
            samePowerUse(p, use) ? { cardId: p.cardId, powerIndex: p.powerIndex, picks } : p
        )
        const targets = this.flow.value('targets')
        const source = this.flow.sourceOf('targets')
        this.keepingDice(() => {
            this.flow.set('plans', staged)
            if (targets !== undefined && source !== undefined) {
                this.flow.set('targets', targets, source)
            }
        })
    }

    isPlanDeclared(use: PowerUseKey): boolean {
        return this.plans.some((p) => samePowerUse(p, use))
    }

    // A plan change keeps the targets it still allows and drops the rest (Relic Hunter's relics).
    declarePlan(use: PowerUseKey, on: boolean): void {
        const offered = this.planOptions.some((p) => samePowerUse(p, use))
        if (!offered) return
        const staged = (this.flow.value('plans') ?? []).filter(
            (p) => !samePowerUse(p, use) && this.planOptions.some((o) => samePowerUse(o, p))
        )
        const plans: StagedPlan[] = on
            ? [...staged, { cardId: use.cardId, powerIndex: use.powerIndex }]
            : staged
        const defender = this.defender
        const kept = defender
            ? this.targets.filter((target) =>
                  campaignTargetOptions(this.session.gameState, defender, plans, this.targets).some(
                      (o) => sameTarget(o, target)
                  )
              )
            : []
        this.keepingDice(() => {
            this.flow.set('plans', plans)
            if (kept.length > 0) this.flow.set('targets', kept)
        })
    }

    get targetOptions(): CampaignTarget[] {
        const defender = this.defender
        if (!defender) return []
        // Relic Hunter's target is declared now even when the plan itself waits for the allies.
        const playerId = this.playerId
        const plans =
            playerId && this.plansWaitForAllies
                ? attackerPlans(this.session.gameState, playerId, defender)
                : this.plans
        return campaignTargetOptions(
            this.session.gameState,
            defender,
            plans,
            this.flow.value('targets') ?? []
        )
    }

    get targets(): CampaignTarget[] {
        const options = this.targetOptions
        return (this.flow.value('targets') ?? []).filter((t) =>
            options.some((o) => sameTarget(o, t))
        )
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

    toggleTarget(target: CampaignTarget): void {
        if (!this.hasTarget(target) && !this.canToggleTarget(target)) return
        this.keepingDice(() => this.flow.set('targets', toggledTargets(this.targets, target)))
    }

    get targetableSites(): string[] {
        return this.targetOptions.flatMap((target) =>
            target.kind === CampaignTargetKind.Site ? [target.siteId] : []
        )
    }

    isTargetedSite(siteId: string): boolean {
        return this.hasTarget({ kind: CampaignTargetKind.Site, siteId })
    }

    // R-5.5.2 — one attack die per warband in the force.
    get maxDice(): number {
        const playerId = this.playerId
        const defender = this.defender
        if (!playerId || !defender) return 0
        const state = this.session.gameState
        return HydratedCampaign.maxAttackDice(state, partiesOf(state, playerId, defender, []))
    }

    get attackDice(): number | undefined {
        const chosen = this.flow.value('dice')
        return chosen === undefined ? undefined : this.clampDice(chosen)
    }

    setAttackDice(count: number): void {
        if (!this.defender) return
        this.keepingLossOrder(() => this.flow.set('dice', this.clampDice(count)))
    }

    /** R-5.5.5, R-10.22 — where the skulls' kills come from, asked when the force holds more than one kind. */
    get lossSources(): LossSource[] {
        const playerId = this.playerId
        const defender = this.defender
        if (!playerId || !defender) return []
        const state = this.session.gameState
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
        if (index <= 0 || index >= order.length) return
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

    get blockedBecause(): string | undefined {
        const playerId = this.playerId
        const defender = this.defender
        const targets = this.targets
        if (!playerId || !defender || targets.length === 0) return undefined
        const state = this.session.gameState
        const targetReason = reasonCampaignTargetsInvalid(state, playerId, defender, targets)
        if (targetReason) return targetReason
        // R-7.1.2 — the declared plans are paid from one holding, so the engine judges them together.
        const declaration = this.declaration
        return declaration
            ? HydratedCampaign.reasonCannotCampaign(state, playerId, declaration)
            : undefined
    }

    get declarable(): boolean {
        return this.declaration !== undefined && this.blockedBecause === undefined
    }

    async declare(): Promise<void> {
        const declaration = this.declaration
        if (!declaration || !this.declarable) return
        await this.session.declareCampaign(declaration)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    // Undo takes one target or one plan at a time, the last one chosen first.
    back(): boolean {
        const top = this.flow.highestManualStage()
        if (top === 'targets' && this.targets.length > 1) {
            this.flow.set('targets', this.targets.slice(0, -1))
            return true
        }
        if (top === 'plans' && this.plans.length > 1) {
            this.flow.set('plans', this.plans.slice(0, -1))
            return true
        }
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }

    // One possible pool is taken for the player; any other waits for their tap.
    private autoSelectDice(): void {
        if (this.defender !== undefined && this.maxDice <= 1) {
            this.flow.autoSelect('dice', this.maxDice)
        }
    }

    // R-5.5.2 — "up to", so an empty pool is a choice.
    private clampDice(count: number): number {
        return Math.max(0, Math.min(count, this.maxDice))
    }

    // The dice do not depend on the plans or the targets, so a change to those keeps them.
    private keepingDice(change: () => void): void {
        const dice = this.flow.value('dice')
        const source = this.flow.sourceOf('dice')
        this.keepingLossOrder(change)
        if (dice !== undefined && source !== undefined) {
            this.keepingLossOrder(() => this.flow.set('dice', dice, source))
        }
    }

    // Nor does the loss order, which is read back only while it names the force's sources.
    private keepingLossOrder(change: () => void): void {
        const order = this.flow.value('lossOrder')
        const source = this.flow.sourceOf('lossOrder')
        change()
        if (order !== undefined && source !== undefined) this.flow.set('lossOrder', order, source)
    }
}
