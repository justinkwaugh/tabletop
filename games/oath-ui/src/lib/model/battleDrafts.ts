import { assertExists } from '@tabletop/common'
import {
    CampaignTargetKind,
    HydratedCampaignDefeatKills,
    HydratedCampaignAttackPlans,
    HydratedCampaignDefend,
    HydratedCampaignResolveVictory,
    HydratedCampaignSacrifice,
    MachineState,
    countOf,
    forceTotal,
    powerKey,
    shroudedWoodChooser,
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
import { declaredPlan, planChoices } from './planChoices.js'
import { emptyPicks, picksComplete, type PowerChoicePicks } from './powerChoices.js'
import { StagedFlow, type PanelDraft, type StagesCover } from './stagedFlow.svelte.js'
import type { OathGameSession } from './session.svelte.js'

/** Keyed by site, then by warband owner. */
type PlaceCounts = Record<string, Partial<Record<WarbandOwner, number>>>
type Spoils = {
    placeCounts: PlaceCounts
    bottomSlots: string[]
    banishSiteId?: string
    /** R-11.7 — banished from a Shrouded Wood whose ruler chooses the site. */
    banishByWood?: boolean
}
type VictoryValueByStage = { spoils: Spoils }

const VICTORY_STAGE_ORDER = ['spoils'] as const
const _victoryStagesAreCovered: StagesCover<VictoryValueByStage, typeof VICTORY_STAGE_ORDER> = true
void _victoryStagesAreCovered

/** R-5.5.7 — the attacker's spoils: warbands onto the sites taken, and Relic Hunter's bottomed relics. */
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

    private get spoils(): Spoils {
        return this.flow.value('spoils') ?? { placeCounts: {}, bottomSlots: [] }
    }

    private get targets() {
        return this.playerId ? (this.session.gameState.campaign?.targets ?? []) : []
    }

    get capturedSites() {
        return this.targets.flatMap((target) =>
            target.kind === CampaignTargetKind.Site ? [target.siteId] : []
        )
    }

    // R-10.9, R-5.5.7.I — "from your force", so the board is the ceiling, owner by owner.
    get forceOwners(): WarbandOwner[] {
        return warbandEntries(this.forceBoard)
            .filter(([, count]) => count > 0)
            .map(([owner]) => owner)
    }

    get forceAvailable() {
        return this.forceOwners.reduce((sum, owner) => sum + countOf(this.forceBoard, owner), 0)
    }

    private get forceBoard(): WarbandCounts {
        const playerId = this.playerId
        return playerId ? this.session.gameState.getPlayerState(playerId).warbandsOnBoard : {}
    }

    countAt(siteId: string, owner: WarbandOwner): number {
        return this.capturedSites.includes(siteId) && this.forceOwners.includes(owner)
            ? (this.spoils.placeCounts[siteId]?.[owner] ?? 0)
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

    get relicTargets() {
        return this.targets.flatMap((t) =>
            t.kind === CampaignTargetKind.SiteRelic ? [t.slotId] : []
        )
    }

    get bottomSlots() {
        return this.spoils.bottomSlots.filter((slotId) => this.relicTargets.includes(slotId))
    }

    ceilingAt(siteId: string, owner: WarbandOwner): number {
        const elsewhere = this.capturedSites
            .filter((other) => other !== siteId)
            .reduce((sum, other) => sum + this.countAt(other, owner), 0)
        return Math.max(0, countOf(this.forceBoard, owner) - elsewhere)
    }

    setPlaceCount(siteId: string, owner: WarbandOwner, count: number): void {
        if (!this.capturedSites.includes(siteId) || !this.forceOwners.includes(owner)) return
        const placeCounts = {
            ...this.spoils.placeCounts,
            [siteId]: {
                ...this.spoils.placeCounts[siteId],
                [owner]: Math.max(0, Math.min(count, this.ceilingAt(siteId, owner)))
            }
        }
        this.flow.set('spoils', { ...this.spoils, placeCounts })
    }

    setBottom(slotId: string, bottom: boolean): void {
        if (!this.relicTargets.includes(slotId)) return
        const rest = this.bottomSlots.filter((s) => s !== slotId)
        const bottomSlots = bottom ? [...rest, slotId] : rest
        this.flow.set('spoils', { ...this.spoils, bottomSlots })
    }

    /** R-11.7 — the defeated pawn stands at a Shrouded Wood whose enemy ruler chooses where it goes. */
    get woodChooses(): boolean {
        const defenderId = this.session.gameState.campaign?.defenderPlayerId
        return (
            this.playerId !== undefined &&
            this.mayBurnFavor &&
            defenderId !== undefined &&
            shroudedWoodChooser(this.session.gameState, defenderId) !== undefined
        )
    }

    get banishByWood(): boolean {
        return this.woodChooses && this.spoils.banishByWood === true
    }

    setBanishByWood(on: boolean): void {
        if (this.woodChooses) this.flow.set('spoils', { ...this.spoils, banishByWood: on })
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

    get banishSite(): string | undefined {
        const siteId = this.spoils.banishSiteId
        return siteId !== undefined && this.banishSites.includes(siteId) ? siteId : undefined
    }

    setBanishSite(siteId: string | undefined): void {
        if (siteId !== undefined && !this.banishSites.includes(siteId)) return
        this.flow.set('spoils', { ...this.spoils, banishSiteId: siteId })
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

    async takeSpoils(burnFavor: boolean): Promise<void> {
        if (!this.playerId) return
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

type PlanValueByStage = { plans: string[]; planPicks: Record<string, PowerChoicePicks> }

const PLAN_STAGE_ORDER = ['plans', 'planPicks'] as const
const _planStagesAreCovered: StagesCover<PlanValueByStage, typeof PLAN_STAGE_ORDER> = true
void _planStagesAreCovered

/** R-5.5.3 — one player's battle plans, each with the picks its text asks for. */
abstract class PlanDeclarationDraft implements PanelDraft {
    private flow = new StagedFlow<PlanValueByStage>(PLAN_STAGE_ORDER)

    constructor(protected readonly session: OathGameSession) {}

    /** The seat on screen, while it is the one declaring. */
    protected abstract get playerId(): string | undefined

    abstract get usable(): CardPower[]

    get plans(): BattlePlanUse[] {
        const playerId = this.playerId
        if (!playerId) return []
        const chosen = this.flow.value('plans') ?? []
        const picks = this.flow.value('planPicks') ?? {}
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
        return this.flow.value('planPicks')?.[powerKey(use.cardId, use.powerIndex)] ?? emptyPicks()
    }

    setPlanPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        if (!this.isDeclared(use)) return
        this.flow.set('planPicks', {
            ...this.flow.value('planPicks'),
            [powerKey(use.cardId, use.powerIndex)]: picks
        })
    }

    isDeclared(use: PowerUseKey): boolean {
        return this.plans.some((p) => samePowerUse(p, use))
    }

    /** "Use plans" waits for a plan, and for every declared plan's picks. */
    get plansComplete(): boolean {
        const declared = this.usable.filter((power) => this.isDeclared(power))
        return (
            declared.length > 0 &&
            declared.every((power) =>
                picksComplete(this.planChoicesOf(power), this.planPicksOf(power))
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
        const picks = this.flow.value('planPicks')
        this.flow.set('plans', on ? [...rest, key] : rest)
        if (picks !== undefined) this.flow.set('planPicks', picks)
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

    setPicked(index: number, count: number): void {
        const group = this.groups[index]
        if (!group) return
        this.flow.set('kills', this.picked.with(index, Math.max(0, Math.min(count, group.count))))
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

function total(counts: readonly number[]): number {
    return counts.reduce((sum, count) => sum + count, 0)
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
 * or which half dies in defeat. Asked only when the force holds more than one kind.
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

    get choosesSacrifice(): boolean {
        return this.force.length > 1 && this.needed > 0
    }

    get choosesDefeat(): boolean {
        return (
            this.force.length > 1 &&
            this.defeatRequired > 0 &&
            this.defeatRequired < forceTotal(this.force)
        )
    }

    get sacrificed(): number[] {
        return this.picksFor('sacrificed')
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

    private picksFor(stage: 'sacrificed' | 'defeated'): number[] {
        const stored = this.flow.value(stage) ?? []
        return this.force.map((group, index) => Math.min(stored[index] ?? 0, group.count))
    }

    private setPick(stage: 'sacrificed' | 'defeated', index: number, count: number): void {
        const group = this.force[index]
        if (!group) return
        const picks = this.picksFor(stage)
        this.flow.set(stage, picks.with(index, Math.max(0, Math.min(count, group.count))))
    }

    private groupsOf(picks: number[]): WarbandGroup[] {
        return this.force
            .map((group, index) => ({ ...group, count: picks[index] ?? 0 }))
            .filter((group) => group.count > 0)
    }
}
