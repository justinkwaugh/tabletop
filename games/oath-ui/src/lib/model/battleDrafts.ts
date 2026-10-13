import { assertExists } from '@tabletop/common'
import {
    CampaignTargetKind,
    HydratedCampaignDefeatKills,
    HydratedCampaignAttackPlans,
    HydratedCampaignDefend,
    HydratedCampaignResolveVictory,
    HydratedCampaignSacrifice,
    HydratedCampaignSkullLosses,
    MachineState,
    countOf,
    defeatPickMatters,
    forceTotal,
    powerKey,
    shroudedWoodChooser,
    takeFromGroups,
    warbandEntries,
    type BattlePlanUse,
    type CardPower,
    type LegalChoice,
    type CampaignPlacement,
    type PowerUseKey,
    type WarbandCounts,
    type WarbandGroup,
    type WarbandOwner
} from '@tabletop/oath'
import { samePowerUse } from './powerUse.js'
import { declaredPlan, planChoices, planMoves, planPicksComplete } from './planChoices.js'
import { emptyPicks, type PowerChoicePicks } from './powerChoices.js'
import type { MovePick, PowerMoves } from './powerMoves.js'
import {
    StagedFlow,
    TapHistoryDraft,
    type PanelDraft,
    type StagesCover
} from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'

/** Keyed by site, then by warband owner. */
type PlaceCounts = Record<string, Partial<Record<WarbandOwner, number>>>

/** R-5.5.7.III, R-11.7 — the defeated pawn left, banished to a site, or left to the Wood's ruler. */
type PawnChoice = { kind: 'leave' } | { kind: 'site'; siteId: string } | { kind: 'wood' }

/**
 * The warbands' and the relics' steps are each a pick stage and an end stage, so Undo returns to
 * them with their picks still marked, then clears those. The pawn's one tap is its stage, so Undo
 * returns to the pawn's step bare. The favor's buttons send; they store nothing.
 */
type VictoryValueByStage = {
    counts: PlaceCounts
    warbands: true
    relicPicks: Record<string, 'keep' | 'bottom'>
    relics: true
    pawn: PawnChoice
}

const VICTORY_STAGE_ORDER = ['counts', 'warbands', 'relicPicks', 'relics', 'pawn'] as const
const _victoryStagesAreCovered: StagesCover<VictoryValueByStage, typeof VICTORY_STAGE_ORDER> = true
void _victoryStagesAreCovered

/** R-5.5.7's sections, in the Law's order. */
export type SpoilsStep = 'warbands' | 'relics' | 'pawn' | 'favor'

/** One owner's warbands onto one site taken. */
export type WarbandRow = { siteId: string; owner: WarbandOwner }

/**
 * R-5.5.7 — the attacker's spoils, one step at a time in the Law's order: warbands onto the sites
 * taken (I), Relic Hunter's relics (II), the defeated pawn (III), then the favor, whose two buttons
 * send everything as one action. A step with nothing to choose is skipped.
 */
export class VictoryDraft implements PanelDraft {
    private flow = new StagedFlow<VictoryValueByStage>(VICTORY_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const campaign = this.session.gameState.campaign
        const playerId = this.session.liveSeatId
        return this.session.gameState.machineState === MachineState.CampaignVictory &&
            playerId !== undefined &&
            campaign?.attackerPlayerId === playerId
            ? playerId
            : undefined
    }

    private get targets() {
        return this.playerId ? (this.session.gameState.campaign?.targets ?? []) : []
    }

    get steps(): SpoilsStep[] {
        if (!this.playerId) return []
        const steps: SpoilsStep[] = []
        if (this.warbandRows.length > 0) steps.push('warbands')
        if (this.relicTargets.length > 0) steps.push('relics')
        if (this.banishSites.length > 0 || this.woodChooses) steps.push('pawn')
        if (this.mayBurnFavor) steps.push('favor')
        return steps
    }

    /** The first step not yet taken; none when there is nothing to choose. */
    get step(): SpoilsStep | undefined {
        return this.steps.find((step) => !this.taken(step))
    }

    /** From 1; 0 with no step. */
    get stepNumber(): number {
        const step = this.step
        return step === undefined ? 0 : this.steps.indexOf(step) + 1
    }

    get isLastStep(): boolean {
        const step = this.step
        return step !== undefined && step === this.steps[this.steps.length - 1]
    }

    private taken(step: SpoilsStep): boolean {
        switch (step) {
            case 'warbands':
                return this.flow.value('warbands') === true
            case 'relics':
                return this.flow.value('relics') === true
            case 'pawn':
                return this.pawnChosen
            case 'favor':
                return false
        }
    }

    /** "Next": a step with several rows to set, or the warbands' default to accept, not the last. */
    get nextShown(): boolean {
        if (this.isLastStep) return false
        if (this.step === 'warbands') return true
        return this.step === 'relics' && this.relicTargets.length > 1 && this.relicsChosen
    }

    next(): void {
        if (!this.nextShown) return
        if (this.step === 'warbands') this.flow.set('warbands', true)
        else if (this.step === 'relics') this.flow.set('relics', true)
    }

    /** "Take spoils" closing a last step that is not the favor's, once its picks are made. */
    get sendShown(): boolean {
        const step = this.step
        if (step === undefined) return this.playerId !== undefined
        if (!this.isLastStep) return false
        if (step === 'warbands') return true
        return step === 'relics' && this.relicsChosen
    }

    // R-5.5.7.I — in the map's order: the Cradle, the Provinces, the Hinterland, each top to bottom.
    get capturedSites(): string[] {
        const taken = this.targets.flatMap((target) =>
            target.kind === CampaignTargetKind.Site ? [target.siteId] : []
        )
        return this.session.gameState.allSiteIds().filter((siteId) => taken.includes(siteId))
    }

    // R-10.9, R-5.5.7.I — "from your force", so the board is the ceiling, owner by owner; the
    // player's own warbands first.
    get forceOwners(): WarbandOwner[] {
        const playerId = this.playerId
        return warbandEntries(this.forceBoard)
            .filter(([, count]) => count > 0)
            .map(([owner]) => owner)
            .sort((a, b) => Number(b === playerId) - Number(a === playerId))
    }

    get forceAvailable() {
        return this.forceOwners.reduce((sum, owner) => sum + countOf(this.forceBoard, owner), 0)
    }

    private get forceBoard(): WarbandCounts {
        const playerId = this.playerId
        return playerId ? this.session.gameState.getPlayerState(playerId).warbandsOnBoard : {}
    }

    // R-7.1.4-H1, R-9.2 — Ring of Devotion leaves zero the one legal count, so nothing to choose.
    private get mayPlace(): boolean {
        const playerId = this.playerId
        const [siteId] = this.capturedSites
        const [owner] = this.forceOwners
        if (playerId === undefined || siteId === undefined || owner === undefined) return false
        return (
            HydratedCampaignResolveVictory.reasonCannotResolveVictory(
                this.session.gameState,
                playerId,
                { placements: [{ siteId, owner, count: 1 }], burnFavor: false }
            ) === undefined
        )
    }

    get warbandRows(): WarbandRow[] {
        if (!this.mayPlace) return []
        return this.capturedSites.flatMap((siteId) =>
            this.forceOwners.map((owner) => ({ siteId, owner }))
        )
    }

    /** 1 warband at each site taken while the force lasts, in the map's order; any number may follow. */
    private get defaultCounts(): PlaceCounts {
        if (!this.mayPlace) return {}
        const left = new Map(
            this.forceOwners.map((owner) => [owner, countOf(this.forceBoard, owner)])
        )
        const counts: PlaceCounts = {}
        for (const siteId of this.capturedSites) {
            const owner = this.forceOwners.find((candidate) => (left.get(candidate) ?? 0) > 0)
            if (owner === undefined) break
            left.set(owner, (left.get(owner) ?? 0) - 1)
            counts[siteId] = { [owner]: 1 }
        }
        return counts
    }

    countAt(siteId: string, owner: WarbandOwner): number {
        const counts = this.flow.value('counts') ?? this.defaultCounts
        return this.mayPlace &&
            this.capturedSites.includes(siteId) &&
            this.forceOwners.includes(owner)
            ? (counts[siteId]?.[owner] ?? 0)
            : 0
    }

    /** Each taken site's total, whoever's warbands they are. */
    get placeCounts(): Record<string, number> {
        return Object.fromEntries(
            this.capturedSites.map((siteId) => [
                siteId,
                this.forceOwners.reduce((sum, owner) => sum + this.countAt(siteId, owner), 0)
            ])
        )
    }

    get placedTotal() {
        return Object.values(this.placeCounts).reduce((sum, n) => sum + n, 0)
    }

    get placements(): CampaignPlacement[] {
        return this.capturedSites
            .flatMap((siteId) =>
                this.forceOwners.map((owner) => ({
                    siteId,
                    owner,
                    count: this.countAt(siteId, owner)
                }))
            )
            .filter((placement) => placement.count > 0)
    }

    /** One owner's warbands in the force: a row draws a piece for each. */
    forceOf(owner: WarbandOwner): number {
        return countOf(this.forceBoard, owner)
    }

    ceilingAt(siteId: string, owner: WarbandOwner): number {
        const elsewhere = this.capturedSites
            .filter((other) => other !== siteId)
            .reduce((sum, other) => sum + this.countAt(other, owner), 0)
        return Math.max(0, this.forceOf(owner) - elsewhere)
    }

    /** A tap on a row's Nth warband places N, and on the one at its count places none. */
    tapWarband(siteId: string, owner: WarbandOwner, n: number): void {
        if (n < 1 || n > this.ceilingAt(siteId, owner)) return
        this.setPlaceCount(siteId, owner, n === this.countAt(siteId, owner) ? 0 : n)
    }

    /** One row's count; with one row the tap is the step's choice and moves on, unless it is the last. */
    setPlaceCount(siteId: string, owner: WarbandOwner, count: number): void {
        if (this.step !== 'warbands') return
        if (!this.capturedSites.includes(siteId) || !this.forceOwners.includes(owner)) return
        const counts: PlaceCounts = Object.fromEntries(
            this.capturedSites.map((site) => [
                site,
                Object.fromEntries(this.forceOwners.map((o) => [o, this.countAt(site, o)]))
            ])
        )
        counts[siteId] = {
            ...counts[siteId],
            [owner]: Math.max(0, Math.min(count, this.ceilingAt(siteId, owner)))
        }
        this.flow.set('counts', counts)
        if (this.warbandRows.length === 1 && !this.isLastStep) this.flow.set('warbands', true)
    }

    // Relic Hunter — "you may put any relics you take on the bottom of the relic deck".
    get relicTargets() {
        return this.targets.flatMap((t) =>
            t.kind === CampaignTargetKind.SiteRelic ? [t.slotId] : []
        )
    }

    /** Keep it or the bottom of the relic deck; none until tapped. */
    relicChoice(slotId: string): 'keep' | 'bottom' | undefined {
        return this.relicTargets.includes(slotId)
            ? this.flow.value('relicPicks')?.[slotId]
            : undefined
    }

    private get relicsChosen(): boolean {
        return this.relicTargets.every((slotId) => this.relicChoice(slotId) !== undefined)
    }

    get bottomSlots() {
        return this.relicTargets.filter((slotId) => this.relicChoice(slotId) === 'bottom')
    }

    /** One relic's choice; with one relic the tap is the step's choice and moves on, unless it is the last. */
    setRelic(slotId: string, bottom: boolean): void {
        if (this.step !== 'relics' || !this.relicTargets.includes(slotId)) return
        const choice: 'keep' | 'bottom' = bottom ? 'bottom' : 'keep'
        this.flow.set('relicPicks', { ...this.flow.value('relicPicks'), [slotId]: choice })
        if (this.relicTargets.length === 1 && !this.isLastStep) this.flow.set('relics', true)
    }

    /** R-11.7 — the defeated pawn stands at a Shrouded Wood whose enemy ruler chooses where it goes. */
    get woodRuler(): string | undefined {
        const defenderId = this.session.gameState.campaign?.defenderPlayerId
        if (this.playerId === undefined || !this.mayBurnFavor || defenderId === undefined) {
            return undefined
        }
        return shroudedWoodChooser(this.session.gameState, defenderId)
    }

    get woodChooses(): boolean {
        return this.woodRuler !== undefined
    }

    /** R-5.5.7.III — the sites the engine accepts the defeated pawn being sent to. */
    get banishSites(): string[] {
        const playerId = this.playerId
        if (!playerId || !this.mayBurnFavor || this.woodChooses) return []
        const state = this.session.gameState
        return state.allSiteIds().filter(
            (banishToSiteId) =>
                HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, playerId, {
                    placements: this.placements,
                    burnFavor: false,
                    banishToSiteId
                }) === undefined
        )
    }

    /** The sites lit on the map while the pawn's step is open: a tap banishes it there. */
    get mapSites(): string[] {
        return this.step === 'pawn' ? this.banishSites : []
    }

    private get pawnChoice(): PawnChoice | undefined {
        return this.flow.value('pawn')
    }

    private get pawnChosen(): boolean {
        const choice = this.pawnChoice
        switch (choice?.kind) {
            case undefined:
                return false
            case 'leave':
                return true
            case 'site':
                return this.banishSites.includes(choice.siteId)
            case 'wood':
                return this.woodChooses
        }
    }

    get banishSite(): string | undefined {
        const choice = this.pawnChoice
        return choice?.kind === 'site' && this.banishSites.includes(choice.siteId)
            ? choice.siteId
            : undefined
    }

    get banishByWood(): boolean {
        return this.woodChooses && this.pawnChoice?.kind === 'wood'
    }

    leavePawn(): void {
        if (this.step === 'pawn') this.flow.set('pawn', { kind: 'leave' })
    }

    banishTo(siteId: string): void {
        if (this.step === 'pawn' && this.banishSites.includes(siteId)) {
            this.flow.set('pawn', { kind: 'site', siteId })
        }
    }

    letWoodRulerChoose(): void {
        if (this.step === 'pawn' && this.woodChooses) this.flow.set('pawn', { kind: 'wood' })
    }

    get blockedBecause(): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'The spoils are taken from a seat')
        return HydratedCampaignResolveVictory.reasonCannotResolveVictory(
            this.session.gameState,
            playerId,
            {
                placements: this.placements,
                burnFavor: false,
                banishToSiteId: this.banishSite,
                banish: this.banishByWood || undefined
            }
        )
    }

    // R-5.5.7.III — banishing and burning exist only against a real player's pawn and favor.
    get mayBurnFavor(): boolean {
        const campaign = this.session.gameState.campaign
        return (
            campaign?.defenderPlayerId !== undefined &&
            campaign.targets.some((target) => target.kind === CampaignTargetKind.PawnAndFavor)
        )
    }

    get burnAmount(): number {
        return HydratedCampaignResolveVictory.favorToBurn(this.session.gameState)
    }

    /** The last choice: the favor's two buttons, or "Take spoils" closing an earlier last step. */
    async takeSpoils(burnFavor: boolean): Promise<void> {
        if (!this.playerId || !(this.step === 'favor' || this.sendShown)) return
        await this.session.resolveCampaignVictory(
            this.placements,
            burnFavor,
            this.bottomSlots,
            this.banishSite,
            this.banishByWood
        )
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

/** The plans declared, by key, and each plan's picks, kept while its plan is taken back. */
type PlanDeclaration = { plans: string[]; planPicks: Record<string, PowerChoicePicks> }

/**
 * R-5.5.3 — one player's battle plans, each with the picks its text asks for. The draft keeps the
 * plans and picks after each tap, so Undo takes back one tap at a time.
 */
abstract class PlanDeclarationDraft extends TapHistoryDraft<PlanDeclaration> {
    constructor(protected readonly session: OathGameSession) {
        super({ plans: [], planPicks: {} })
    }

    /** The seat on screen, while it is the one declaring. */
    protected abstract get playerId(): string | undefined

    abstract get usable(): CardPower[]

    get plans(): BattlePlanUse[] {
        const playerId = this.playerId
        if (!playerId) return []
        const { plans: chosen, planPicks: picks } = this.current
        return this.usable
            .filter((power) => chosen.includes(powerKey(power.cardId, power.powerIndex)))
            .map((power) =>
                declaredPlan(
                    this.session.gameState,
                    playerId,
                    power,
                    picks[powerKey(power.cardId, power.powerIndex)]
                )
            )
    }

    /** R-5.5.3 — the choices a declared plan's text opens. */
    planChoicesOf(power: CardPower): LegalChoice[] {
        const playerId = this.playerId
        return playerId && this.isDeclared(power)
            ? planChoices(this.session.gameState, playerId, power)
            : []
    }

    planPicksOf(use: PowerUseKey): PowerChoicePicks {
        return this.current.planPicks[powerKey(use.cardId, use.powerIndex)] ?? emptyPicks()
    }

    setPlanPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        if (!this.isDeclared(use)) return
        this.tap({
            ...this.current,
            planPicks: { ...this.current.planPicks, [powerKey(use.cardId, use.powerIndex)]: picks }
        })
    }

    /** Warning Signals' moves, one at a time, each read on the state the moves before it leave. */
    movesOf(use: PowerUseKey): PowerMoves | undefined {
        const playerId = this.playerId
        const power = this.usable.find((p) => samePowerUse(p, use))
        return playerId && power && this.isDeclared(power)
            ? planMoves(this.session.gameState, playerId, power, this.planPicksOf(power))
            : undefined
    }

    // A move's From, count or To is a tap like any other pick, so Undo takes it back as one.
    setMoves(use: PowerUseKey, moves: MovePick[]): void {
        this.setPlanPicks(use, { ...this.planPicksOf(use), moves })
    }

    // Read from the keys, not `plans`, which reads every declared plan's choices.
    isDeclared(use: PowerUseKey): boolean {
        const key = powerKey(use.cardId, use.powerIndex)
        return (
            this.playerId !== undefined &&
            this.current.plans.includes(key) &&
            this.usable.some((p) => samePowerUse(p, use))
        )
    }

    /** "Use plans" waits for a plan, and for every declared plan's picks. */
    get plansComplete(): boolean {
        const playerId = this.playerId
        const declared = this.usable.filter((power) => this.isDeclared(power))
        return (
            playerId !== undefined &&
            declared.length > 0 &&
            declared.every((power) =>
                planPicksComplete(this.session.gameState, playerId, power, this.planPicksOf(power))
            )
        )
    }

    /** Why the engine refuses the plans as picked, read only once they are complete. */
    get usePlansRefusedBecause(): string | undefined {
        return this.plansComplete ? this.reasonCannotDeclare(this.plans) : undefined
    }

    /** "No plans" is always complete; the engine still judges it. */
    get noPlansRefusedBecause(): string | undefined {
        return this.reasonCannotDeclare([])
    }

    /** Why the engine refuses these plans from the seat on screen. */
    protected abstract reasonCannotDeclare(plans: BattlePlanUse[]): string | undefined

    setPlan(use: PowerUseKey, on: boolean): void {
        if (!this.usable.some((p) => samePowerUse(p, use))) return
        const key = powerKey(use.cardId, use.powerIndex)
        const rest = this.plans
            .map((p) => powerKey(p.cardId, p.powerIndex))
            .filter((k) => k !== key)
        this.tap({ ...this.current, plans: on ? [...rest, key] : rest })
    }

    /**
     * Undo takes back the last tap: a plan ticked or unticked, a pick, or a move's From, count or
     * To, and the plans and picks are as they were before it.
     */
    protected isBare(declaration: PlanDeclaration): boolean {
        return declaration.plans.length === 0
    }
}

/** R-5.5.3, R-7.5.2 — the battle plans the answering defender or ally declares. */
export class DefenceDraft extends PlanDeclarationDraft {
    protected get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        return playerId !== undefined &&
            HydratedCampaignDefend.answeringPlayerId(this.session.gameState) === playerId
            ? playerId
            : undefined
    }

    get usable(): CardPower[] {
        return this.playerId
            ? HydratedCampaignDefend.usablePlans(this.session.gameState, this.playerId)
            : []
    }

    get answeringPlayerId(): string | undefined {
        return HydratedCampaignDefend.answeringPlayerId(this.session.gameState)
    }

    protected reasonCannotDeclare(plans: BattlePlanUse[]): string | undefined {
        const playerId = this.session.myPlayer?.id
        assertExists(playerId, 'Battle plans are declared from a seat')
        return HydratedCampaignDefend.reasonCannotDefend(this.session.gameState, playerId, plans)
    }

    /** "Use plans" sends the plans picked; "No plans" sends none, whatever is picked. */
    async answer(usePlans: boolean): Promise<void> {
        if (!this.playerId) return
        await this.session.defendCampaign(usePlans ? this.plans : [])
    }
}

/** R-5.5.2.a then R-5.5.3 — the attacker's plans, once the Citizens asked to join have answered. */
export class AttackPlansDraft extends PlanDeclarationDraft {
    get attackerId(): string | undefined {
        return HydratedCampaignAttackPlans.attackerId(this.session.gameState)
    }

    protected get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        return playerId !== undefined && this.attackerId === playerId ? playerId : undefined
    }

    get usable(): CardPower[] {
        return this.playerId
            ? HydratedCampaignAttackPlans.usablePlans(this.session.gameState, this.playerId)
            : []
    }

    protected reasonCannotDeclare(plans: BattlePlanUse[]): string | undefined {
        const playerId = this.playerId
        if (!playerId) return 'the attacker declares these plans'
        return HydratedCampaignAttackPlans.reasonCannotDeclare(
            this.session.gameState,
            playerId,
            plans
        )
    }

    /** "Use plans" sends the plans picked; "No plans" sends none, whatever is picked. */
    async declare(usePlans: boolean): Promise<void> {
        const plans = usePlans ? this.plans : []
        if (!this.playerId || this.reasonCannotDeclare(plans) !== undefined) return
        await this.session.declareAttackPlans(plans)
    }
}

type DefeatValueByStage = { kills: number[] }

const DEFEAT_STAGE_ORDER = ['kills'] as const
const _defeatStagesAreCovered: StagesCover<DefeatValueByStage, typeof DEFEAT_STAGE_ORDER> = true
void _defeatStagesAreCovered

/** R-5.5.6.a — the defeated defending side's own pick of which of its warbands die. */
export class DefeatDraft implements PanelDraft {
    private flow = new StagedFlow<DefeatValueByStage>(DEFEAT_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        return playerId !== undefined &&
            HydratedCampaignDefeatKills.chooserId(this.session.gameState) === playerId
            ? playerId
            : undefined
    }

    get groups(): WarbandGroup[] {
        return this.playerId ? (this.session.gameState.campaign?.defendingForce ?? []) : []
    }

    get required(): number {
        return this.playerId ? HydratedCampaignDefeatKills.required(this.session.gameState) : 0
    }

    get picked(): number[] {
        const stored = this.flow.value('kills') ?? []
        return this.groups.map((group, index) => Math.min(stored[index] ?? 0, group.count))
    }

    get pickedTotal(): number {
        return this.picked.reduce((sum, count) => sum + count, 0)
    }

    get kills(): WarbandGroup[] {
        return this.groups
            .map((group, index) => ({ ...group, count: this.picked[index] ?? 0 }))
            .filter((group) => group.count > 0)
    }

    get blockedBecause(): string | undefined {
        const playerId = this.playerId
        if (!playerId) return undefined
        return HydratedCampaignDefeatKills.reasonCannotChoose(
            this.session.gameState,
            playerId,
            this.kills
        )
    }

    /** "Kill" waits for the count owed. */
    get complete(): boolean {
        return this.pickedTotal === this.required
    }

    /** Why the engine refuses the kills as picked, read only once the count is right. */
    get refusedBecause(): string | undefined {
        return this.complete ? this.blockedBecause : undefined
    }

    /** The most this group can give: its warbands, or what the count owed leaves after the others. */
    ceilingAt(index: number): number {
        return ceilingIn(this.groups, this.picked, index, this.required)
    }

    setPicked(index: number, count: number): void {
        if (!this.groups[index]) return
        this.flow.set(
            'kills',
            this.picked.with(index, Math.max(0, Math.min(count, this.ceilingAt(index))))
        )
    }

    async choose(): Promise<void> {
        if (!this.playerId) return
        await this.session.chooseDefeatKills(this.kills)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

type SkullLossesValueByStage = { kills: number[] }

const SKULL_LOSSES_STAGE_ORDER = ['kills'] as const
const _skullLossesStagesAreCovered: StagesCover<
    SkullLossesValueByStage,
    typeof SKULL_LOSSES_STAGE_ORDER
> = true
void _skullLossesStagesAreCovered

/** R-5.5.5 — from revision 7, where the attacker's skulls kill, picked after the roll. */
export class SkullLossesDraft implements PanelDraft {
    private flow = new StagedFlow<SkullLossesValueByStage>(SKULL_LOSSES_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get playerId(): string | undefined {
        const playerId = this.session.liveSeatId
        return playerId !== undefined &&
            HydratedCampaignSkullLosses.canDoCampaignSkullLosses(this.session.gameState, playerId)
            ? playerId
            : undefined
    }

    get groups(): WarbandGroup[] {
        return this.playerId ? HydratedCampaignSkullLosses.sources(this.session.gameState) : []
    }

    get required(): number {
        return this.playerId ? HydratedCampaignSkullLosses.skulls(this.session.gameState) : 0
    }

    get picked(): number[] {
        const stored = this.flow.value('kills') ?? []
        return this.groups.map((group, index) => Math.min(stored[index] ?? 0, group.count))
    }

    get pickedTotal(): number {
        return total(this.picked)
    }

    get kills(): WarbandGroup[] {
        return this.groups
            .map((group, index) => ({ ...group, count: this.picked[index] ?? 0 }))
            .filter((group) => group.count > 0)
    }

    /** "Kill" waits for exactly the skulls. */
    get complete(): boolean {
        return this.required > 0 && this.pickedTotal === this.required
    }

    /** Why the engine refuses the kills as picked, read only once the count is right. */
    get refusedBecause(): string | undefined {
        const playerId = this.playerId
        if (!playerId || !this.complete) return undefined
        return HydratedCampaignSkullLosses.reasonCannotPick(
            this.session.gameState,
            playerId,
            this.kills
        )
    }

    /** A tap on the Nth warband kills N there; a tap on the warband at the count kills none there. */
    tap(index: number, count: number): void {
        const group = this.groups[index]
        if (!group) return
        const picked = this.picked
        const next = picked[index] === count ? 0 : Math.max(0, Math.min(count, group.count))
        this.flow.set('kills', picked.with(index, next))
    }

    async kill(): Promise<void> {
        if (!this.playerId || !this.complete || this.refusedBecause !== undefined) return
        await this.session.chooseSkullLosses(this.kills)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }
}

function total(counts: readonly number[]): number {
    return counts.reduce((sum, count) => sum + count, 0)
}

/** A group's count can rise to its warbands, or to what the total owed leaves after the others. */
function ceilingIn(
    groups: readonly WarbandGroup[],
    picks: readonly number[],
    index: number,
    owed: number
): number {
    const group = groups[index]
    if (!group) return 0
    const elsewhere = total(picks) - (picks[index] ?? 0)
    return Math.max(0, Math.min(group.count, owed - elsewhere))
}

type AttackerLossesValueByStage = { sacrificed: number[]; defeated: number[] }

const ATTACKER_LOSSES_STAGE_ORDER = ['sacrificed', 'defeated'] as const
const _attackerLossesStagesAreCovered: StagesCover<
    AttackerLossesValueByStage,
    typeof ATTACKER_LOSSES_STAGE_ORDER
> = true
void _attackerLossesStagesAreCovered

/**
 * R-5.5.5, R-5.5.6, R-10.22 — the attacker's own losses: which warbands are sacrificed to win,
 * or which half dies in defeat. The sacrifice is asked only when the force holds more than one
 * group; the defeat only when it also mixes owners (R-5.5.5-H1).
 */
export class AttackerLossesDraft implements PanelDraft {
    private flow = new StagedFlow<AttackerLossesValueByStage>(ATTACKER_LOSSES_STAGE_ORDER)

    constructor(private readonly session: OathGameSession) {}

    private get campaign() {
        const campaign = this.session.gameState.campaign
        const playerId = this.session.liveSeatId
        return this.session.gameState.machineState === MachineState.CampaignSacrifice &&
            campaign !== undefined &&
            playerId !== undefined &&
            campaign.attackerPlayerId === playerId
            ? campaign
            : undefined
    }

    get force(): WarbandGroup[] {
        const campaign = this.campaign
        return campaign
            ? HydratedCampaignSacrifice.attackerForce(this.session.gameState, campaign)
            : []
    }

    get needed(): number {
        const campaign = this.campaign
        return campaign ? HydratedCampaignSacrifice.sacrificeNeeded(campaign) : 0
    }

    get defeatRequired(): number {
        const campaign = this.campaign
        return campaign
            ? HydratedCampaignSacrifice.requiredKills(this.session.gameState, campaign, this.force)
            : 0
    }

    /**
     * R-5.5.5 — which warbands to sacrifice is asked when the force stands in more than one group
     * and the rules allow the win at all: with too few warbands, or against Vow of Peace, no split
     * can win, so none is asked and the reason takes the win's place.
     */
    get choosesSacrifice(): boolean {
        return this.force.length > 1 && this.needed > 0 && this.winRefusedOutright === undefined
    }

    /** R-5.5.6 — the half that dies is picked only when the pick can change where the warbands end. */
    get choosesDefeat(): boolean {
        return (
            this.force.length > 1 &&
            this.defeatRequired > 0 &&
            this.defeatRequired < forceTotal(this.force) &&
            defeatPickMatters(this.session.gameState, this.force, this.campaign?.attackerPlayerId)
        )
    }

    /**
     * Why no sacrifice of the number needed can win, whatever warbands are picked: the engine is
     * asked with one split that adds up, so only a reason of the sacrifice itself remains.
     */
    private get winRefusedOutright(): string | undefined {
        if (this.needed === 0) return undefined
        return this.reasonFor(this.needed, takeFromGroups(this.force, this.needed), [])
    }

    /**
     * Picks start empty; a split with one legal answer starts made. With the force in two or more
     * groups, the only split that adds up to the number needed is the whole force.
     */
    get sacrificed(): number[] {
        const whole = this.choosesSacrifice && this.needed === forceTotal(this.force)
        return this.picksFor('sacrificed', whole)
    }

    get defeated(): number[] {
        return this.picksFor('defeated')
    }

    /** R-5.5.5 — nothing to sacrifice: the swords already win, or a battle plan decided it. */
    get wonWithoutSacrifice(): boolean {
        const campaign = this.campaign
        return (
            campaign !== undefined &&
            this.needed === 0 &&
            HydratedCampaignSacrifice.isVictorious(campaign, 0)
        )
    }

    /** "Sacrifice N and win" waits for the warbands, when the force leaves a choice. */
    get winComplete(): boolean {
        return !this.choosesSacrifice || total(this.sacrificed) === this.needed
    }

    /** "Sacrifice nothing" waits for the half that dies, when the force leaves a choice. */
    get loseComplete(): boolean {
        return !this.choosesDefeat || total(this.defeated) === this.defeatRequired
    }

    /** Why the engine refuses the win as picked, read only once it is complete. */
    get winRefusedBecause(): string | undefined {
        return this.needed > 0 && this.winComplete ? this.winBlockedBecause : undefined
    }

    /** Why the engine refuses the loss as picked, read only once it is complete. */
    get loseRefusedBecause(): string | undefined {
        return this.loseComplete ? this.loseBlockedBecause : undefined
    }

    /** The most a group can give to the sacrifice, or to the defeated half. */
    ceilingAt(stage: 'sacrificed' | 'defeated', index: number): number {
        return stage === 'sacrificed'
            ? ceilingIn(this.force, this.sacrificed, index, this.needed)
            : ceilingIn(this.force, this.defeated, index, this.defeatRequired)
    }

    setSacrificed(index: number, count: number): void {
        if (this.choosesSacrifice) this.setPick('sacrificed', index, count)
    }

    setDefeated(index: number, count: number): void {
        if (this.choosesDefeat) this.setPick('defeated', index, count)
    }

    private get sacrificeKills(): WarbandGroup[] | undefined {
        return this.choosesSacrifice ? this.groupsOf(this.sacrificed) : undefined
    }

    // With one kind in the force, or all of it dying, there is nothing to choose.
    private get defeatKills(): WarbandGroup[] {
        return this.choosesDefeat
            ? this.groupsOf(this.defeated)
            : HydratedCampaignSacrifice.attackerDefeatKills(this.session.gameState, 0)
    }

    get winBlockedBecause(): string | undefined {
        return this.reasonFor(this.needed, this.sacrificeKills, [])
    }

    get loseBlockedBecause(): string | undefined {
        return this.reasonFor(0, undefined, this.defeatKills)
    }

    async win(): Promise<void> {
        if (this.winBlockedBecause !== undefined) return
        await this.session.resolveCampaignSacrifice(this.needed, this.sacrificeKills, [])
    }

    async lose(): Promise<void> {
        if (this.loseBlockedBecause !== undefined) return
        await this.session.resolveCampaignSacrifice(0, undefined, this.defeatKills)
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        return this.flow.back() !== undefined
    }

    reset(): void {
        this.flow.reset()
    }

    private reasonFor(
        sacrifice: number,
        sacrificeKills: WarbandGroup[] | undefined,
        defeatKills: WarbandGroup[]
    ): string | undefined {
        const playerId = this.session.liveSeatId
        if (!this.campaign || !playerId) return 'no Campaign of yours is being resolved'
        return HydratedCampaignSacrifice.reasonCannotResolve(this.session.gameState, playerId, {
            sacrifice,
            sacrificeKills,
            defeatKills
        })
    }

    private picksFor(stage: 'sacrificed' | 'defeated', whole = false): number[] {
        const stored = this.flow.value(stage)
        return this.force.map((group, index) =>
            stored === undefined
                ? whole
                    ? group.count
                    : 0
                : Math.min(stored[index] ?? 0, group.count)
        )
    }

    private setPick(stage: 'sacrificed' | 'defeated', index: number, count: number): void {
        if (!this.force[index]) return
        const picks = stage === 'sacrificed' ? this.sacrificed : this.defeated
        const ceiling = this.ceilingAt(stage, index)
        this.flow.set(stage, picks.with(index, Math.max(0, Math.min(count, ceiling))))
    }

    private groupsOf(picks: number[]): WarbandGroup[] {
        return this.force
            .map((group, index) => ({ ...group, count: picks[index] ?? 0 }))
            .filter((group) => group.count > 0)
    }
}
