import { ActionSource, type GameAction } from '@tabletop/common'
import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import {
    MAX_WORMS,
    MESSAGE_SPACE_FACES,
    MESSAGE_SPACE_IDS,
    MachineState,
    PlanKind,
    Quality,
    SubmitPlan,
    fertilizerSacks,
    isOrganic,
    isPlanningState,
    isSown,
    loansToCover,
    marketId,
    planCost,
    planIncome,
    planKindFor,
    planProblem,
    readSetup,
    type DickeKartoffelnProjectedState,
    type DickeKartoffelnSetup,
    type FieldSale,
    type HydratedDickeKartoffelnGameState,
    type HydratedDickeKartoffelnPlayerState,
    type MessageId,
    type Plan,
    type PlanningState,
    type Variety
} from '@tabletop/dicke-kartoffeln'
import { planningRound } from '$lib/utils/history.js'
import { isYearEndAction, latestYearEnd, type YearEndReport } from '$lib/utils/yearEnd.js'
import { draftPlan, type PlanDraft, type PlanEdit } from './draft.js'

export enum TableView {
    Farm = 'Farm',
    Sheet = 'Sheet'
}

const SHEET_ROUNDS: readonly MachineState[] = [
    MachineState.Sowing,
    MachineState.Fertilizing,
    MachineState.RegisteringSales
]

export type ReadableMessage = { messageId: MessageId; faces: readonly number[] | undefined }

export type PlanPreview = {
    plan: Plan
    cost: number
    income: number
    loans: number
    problem: string | undefined
}

export class DickeKartoffelnGameSession extends GameSession<
    DickeKartoffelnProjectedState,
    HydratedDickeKartoffelnGameState
> {
    myPlayerId = $derived(this.myPlayer?.id)

    setup: DickeKartoffelnSetup = $derived(readSetup(this.game.config))

    year: number = $derived(this.gameState.years.currentRound?.number ?? this.setup.years)

    planningRound: PlanningState | undefined = $derived(
        isPlanningState(this.gameState.machineState) ? this.gameState.machineState : undefined
    )

    // Between the last plan sealed and the reveal, the table is still in the round being planned.
    shownRound: MachineState = $derived(
        this.gameState.machineState === MachineState.RevealingPlans
            ? (planningRound(this.currentAction?.simultaneousGroupId) ??
                  this.gameState.machineState)
            : this.gameState.machineState
    )

    myPlanningTurn: boolean = $derived(
        !this.isViewingHistory &&
            !this.gameState.result &&
            this.planningRound !== undefined &&
            this.isMyTurn &&
            this.myPlayerId !== undefined &&
            this.gameState.activePlayerIds.includes(this.myPlayerId)
    )

    yearEnd: YearEndReport | undefined = $derived(
        latestYearEnd(this.actions, this.gameState.years.series)
    )

    private myLastDecisionIndex: number = $derived(
        this.actions.findLast(
            (action) => action.source === ActionSource.User && action.playerId === this.myPlayerId
        )?.index ?? -1
    )

    private yearEndSeen: string | undefined = $state()

    pendingYearEnd: YearEndReport | undefined = $derived.by(() => {
        const report = this.yearEnd
        return this.myPlanningTurn &&
            report?.endIndex !== undefined &&
            report.endIndex > this.myLastDecisionIndex &&
            this.yearEndSeen !== report.key
            ? report
            : undefined
    })

    private yearEndPage: { key: string; step: number } = $state({ key: '', step: 0 })

    yearEndStep: number = $derived(
        this.pendingYearEnd && this.yearEndPage.key === this.pendingYearEnd.key
            ? this.yearEndPage.step
            : 0
    )

    showYearEndStep(step: number) {
        const report = this.pendingYearEnd
        if (!report) {
            return
        }
        this.yearEndPage = {
            key: report.key,
            step: Math.max(0, Math.min(report.phases.length - 1, step))
        }
    }

    finishYearEnd() {
        this.yearEndSeen = this.pendingYearEnd?.key
    }

    planning: boolean = $derived(this.myPlanningTurn && !this.pendingYearEnd)

    view: TableView = $derived(
        SHEET_ROUNDS.includes(this.gameState.machineState) ? TableView.Sheet : TableView.Farm
    )

    farmPlayerId: string | undefined = $derived(
        this.myPlayerId ?? this.gameState.players[0]?.playerId
    )

    sheetPlayerId: string | undefined = $derived(
        this.myPlayerId ?? this.gameState.players[0]?.playerId
    )

    private draft: PlanDraft = $state({ key: '', edits: [] })

    private draftKey = $derived(`${this.myPlayerId}-${this.year}-${this.gameState.machineState}`)

    edits: PlanEdit[] = $derived(
        this.planning && this.draft.key === this.draftKey ? this.draft.edits : []
    )

    planKind: PlanKind | undefined = $derived(
        this.planningRound ? planKindFor(this.planningRound) : undefined
    )

    planner: HydratedDickeKartoffelnPlayerState | undefined = $derived(
        this.planning ? this.myPlayerState : undefined
    )

    preview: PlanPreview | undefined = $derived.by(() => {
        const player = this.planner
        if (!player || !this.planKind) {
            return undefined
        }
        const plan = draftPlan(this.planKind, this.edits)
        const cost = planCost(this.gameState, player, plan)
        const income = planIncome(player, plan)
        const shortfall = cost - income - player.cash
        return {
            plan,
            cost,
            income,
            loans: shortfall > 0 ? loansToCover(shortfall) : 0,
            problem: planProblem(player, plan)
        }
    })

    sealedPlan: Plan | undefined = $derived(this.myPlayerState?.plan)

    // Who has committed in the current round, read from the public submission records.
    sealedPlayerIds: string[] = $derived.by(() => {
        if (!this.planningRound) {
            return []
        }
        const groupId = `${this.year}-${this.planningRound}`
        return this.actions
            .filter((action) => action.simultaneousGroupId === groupId && action.playerId)
            .flatMap((action) => (action.playerId ? [action.playerId] : []))
    })

    private addEdit(edit: PlanEdit) {
        if (!this.planning) {
            return
        }
        this.draft = { key: this.draftKey, edits: [...this.edits, edit] }
    }

    private planField(fieldId: number) {
        return this.planner?.fields.find((field) => field.id === fieldId)
    }

    // Worms already taken from a field in the draft, and worms spread onto it.
    draftWorms(fieldId: number): number {
        const plan = this.preview?.plan
        if (plan?.kind === PlanKind.TakeCompost) {
            return -(plan.takes.find((take) => take.fieldId === fieldId)?.worms ?? 0)
        }
        if (plan?.kind === PlanKind.SpreadCompost) {
            return plan.placements.find((placement) => placement.fieldId === fieldId)?.worms ?? 0
        }
        return 0
    }

    wormsSpread: number = $derived.by(() => {
        const plan = this.preview?.plan
        return plan?.kind === PlanKind.SpreadCompost
            ? plan.placements.reduce((sum, placement) => sum + placement.worms, 0)
            : 0
    })

    fieldTargets: number[] = $derived.by(() => {
        const player = this.planner
        if (!player) {
            return []
        }
        switch (this.planKind) {
            case PlanKind.TakeCompost:
                return player.fields
                    .filter((field) => field.worms + this.draftWorms(field.id) > 0)
                    .map((field) => field.id)
            case PlanKind.Cultivate:
                return player.fields.map((field) => field.id)
            case PlanKind.Sow:
                return player.fields.filter((field) => field.furrow).map((field) => field.id)
            case PlanKind.Fertilize:
            case PlanKind.Spray:
                return player.fields.filter(isSown).map((field) => field.id)
            case PlanKind.RegisterSales:
                return player.fields
                    .filter((field) => (field.harvest ?? 0) > 0)
                    .map((field) => field.id)
            case PlanKind.SpreadCompost:
                return this.wormsSpread < player.ripeCompost
                    ? player.fields
                          .filter((field) => field.worms + this.draftWorms(field.id) < MAX_WORMS)
                          .map((field) => field.id)
                    : []
            default:
                return []
        }
    })

    private pickedField: number | undefined = $state()

    seedPickerField: number | undefined = $derived(
        this.planKind === PlanKind.Sow &&
            this.pickedField !== undefined &&
            this.view === TableView.Farm &&
            this.farmPlayerId === this.myPlayerId
            ? this.fieldTargets.find((fieldId) => fieldId === this.pickedField)
            : undefined
    )

    closeSeedPicker() {
        this.pickedField = undefined
    }

    async clickField(fieldId: number) {
        if (!this.fieldTargets.includes(fieldId)) {
            return
        }
        switch (this.planKind) {
            case PlanKind.Sow:
                this.pickedField = fieldId
                return
            case PlanKind.TakeCompost:
                this.addEdit({ kind: 'take', fieldId })
                return
            case PlanKind.Cultivate:
                this.addEdit({ kind: 'plough', fieldId })
                return
            case PlanKind.Fertilize:
                this.addEdit({ kind: 'fertilize', fieldId })
                return
            case PlanKind.Spray:
                this.addEdit({ kind: 'spray', fieldId })
                return
            case PlanKind.SpreadCompost:
                this.addEdit({ kind: 'spread', fieldId })
                return
        }
    }

    chooseSeed(fieldId: number, variety: Variety | undefined) {
        if (this.planKind === PlanKind.Sow && this.fieldTargets.includes(fieldId)) {
            this.pickedField = undefined
            this.addEdit({ kind: 'seed', fieldId, variety })
        }
    }

    offer(fieldId: number, norm: number, bio: number) {
        const field = this.planField(fieldId)
        const harvest = field?.harvest ?? 0
        if (
            this.planKind !== PlanKind.RegisterSales ||
            !field ||
            norm < 0 ||
            bio < 0 ||
            norm + bio > harvest ||
            (bio > 0 && !isOrganic(field))
        ) {
            return
        }
        this.addEdit({ kind: 'offer', fieldId, norm, bio })
    }

    // Every sack of every harvested field, organic crops to whichever of Bio or Norm pays more now.
    offerAll() {
        const player = this.planner
        if (this.planKind !== PlanKind.RegisterSales || !player) {
            return
        }
        const sales: FieldSale[] = player.fields.flatMap((field) => {
            const sacks = field.harvest ?? 0
            if (sacks === 0 || !field.seed) return []
            const bio =
                isOrganic(field) &&
                this.gameState.price(marketId(field.seed, Quality.Bio)) >=
                    this.gameState.price(marketId(field.seed, Quality.Norm))
            return [{ fieldId: field.id, norm: bio ? 0 : sacks, bio: bio ? sacks : 0 }]
        })
        this.addEdit({ kind: 'offers', sales })
    }

    offeringAll: boolean = $derived.by(() => {
        const player = this.planner
        if (this.planKind !== PlanKind.RegisterSales || !player) {
            return false
        }
        return player.fields.every((field) => {
            const offer = this.offered(field.id)
            return offer.norm + offer.bio === (field.harvest ?? 0)
        })
    })

    sowing(fieldId: number): Variety | undefined {
        const plan = this.preview?.plan
        return plan?.kind === PlanKind.Sow
            ? plan.seeds.find((seed) => seed.fieldId === fieldId)?.variety
            : undefined
    }

    marked(fieldId: number): boolean {
        const plan = this.preview?.plan
        switch (plan?.kind) {
            case PlanKind.Cultivate:
            case PlanKind.Fertilize:
            case PlanKind.Spray:
                return plan.fieldIds.includes(fieldId)
            default:
                return false
        }
    }

    offered(fieldId: number): { norm: number; bio: number } {
        const plan = this.preview?.plan
        const sale =
            plan?.kind === PlanKind.RegisterSales
                ? plan.sales.find((candidate) => candidate.fieldId === fieldId)
                : undefined
        return { norm: sale?.norm ?? 0, bio: sale?.bio ?? 0 }
    }

    fertilizerFor(fieldId: number): number {
        const field = this.planField(fieldId)
        return field ? fertilizerSacks(field) : 1
    }

    seedPrice(variety: Variety): number {
        return this.gameState.seedPrice(variety)
    }

    async submitPlan() {
        const preview = this.preview
        if (!preview || preview.problem) {
            return
        }
        const action = this.createPlayerAction(SubmitPlan, { plan: preview.plan })
        action.simultaneousGroupId = `${this.year}-${this.gameState.machineState}`
        await this.applyAction(action)
    }

    readingMessage: MessageId | undefined = $state()

    readableMessages: ReadableMessage[] = $derived.by(() => {
        const messages = this.gameState.messages
        if (!messages) {
            return []
        }
        const spaces = MESSAGE_SPACE_IDS.map((space) => ({
            messageId: messages.messageOn(space),
            faces: MESSAGE_SPACE_FACES[space]
        }))
        return messages.current
            ? [...spaces, { messageId: messages.current, faces: undefined }]
            : spaces
    })

    readMessage(messageId: MessageId | undefined) {
        this.readingMessage = messageId
    }

    readNeighbourMessage(direction: 1 | -1) {
        const cards = this.readableMessages
        const index = cards.findIndex((card) => card.messageId === this.readingMessage)
        if (index < 0) {
            return
        }
        this.readingMessage = cards[(index + direction + cards.length) % cards.length].messageId
    }

    showView(view: TableView) {
        this.view = view
    }

    playerAidOpen = $state(false)

    togglePlayerAid() {
        this.playerAidOpen = !this.playerAidOpen
    }

    closePlayerAid() {
        this.playerAidOpen = false
    }

    showMyFarm() {
        if (this.myPlayerId) {
            this.showFarm(this.myPlayerId)
        }
    }

    showFarm(playerId: string) {
        this.farmPlayerId = playerId
        this.view = TableView.Farm
    }

    showSheet(playerId: string) {
        this.sheetPlayerId = playerId
        this.view = TableView.Sheet
    }

    // Each round of a year's close is its own history step, so the arrows walk through them.
    override shouldAutoStepAction(action: GameAction, next?: GameAction): boolean {
        return !isYearEndAction(action) && super.shouldAutoStepAction(action, next)
    }

    hasManualSelection(): boolean {
        return this.edits.length > 0
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.draft = { key: this.draftKey, edits: this.edits.slice(0, -1) }
            return
        }
        await super.undo()
    }

    // Another farmer sealing their plan leaves this farmer's draft standing.
    override beforeNewState(transition: PresentedTransition): void {
        if (transition.kind !== 'other-action' && transition.kind !== 'reconciliation') {
            this.draft = { key: '', edits: [] }
            this.pickedField = undefined
        }
    }
}
