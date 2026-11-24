import {
    GameSession,
    undoableStagedSelection,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    Develop,
    ExpandCapacity,
    KindPalette,
    LwPreferenceDefinition,
    type LwPreferences,
    MachineState,
    PassDevelopment,
    Ship,
    isAdjustMarket,
    isNewer,
    isPayTaxes,
    isShip,
    readLwSetup,
    type AdjustMarketMetadata,
    locomotiveData,
    type HydratedLwGameState,
    type LocomotiveId,
    type LwProjectedState,
    type PayTaxesMetadata,
    type Plant,
    type Shipment
} from '@tabletop/locomotive-werks'
import {
    CapacityStageOrder,
    DevelopStageOrder,
    ShipStageOrder,
    addCapacityStep,
    chooseLocomotive,
    closeWerk,
    openWerk,
    keepsWerksOpen,
    mergeCapacitySteps,
    capacityPlan,
    plannedUnits,
    setAutoShip,
    toggleHeld,
    type CapacitySelection,
    type CapacityStep,
    type DevelopSelection,
    type ShipSelection
} from './selection.js'

export enum ReviewStage {
    Production = 'Production',
    Taxes = 'Taxes',
    MarketDemands = 'MarketDemands'
}

const REVIEW_STAGES = [ReviewStage.Production, ReviewStage.Taxes, ReviewStage.MarketDemands]

export type ProductionResult = { playerId: string; units: number; income: number }

// What the end of a round did, for the viewer to step through.
export type RoundReview = {
    round: number
    production: ProductionResult[]
    taxes: PayTaxesMetadata
    market: AdjustMarketMetadata
    marketActionId: string
}

export type UpgradeTarget = { locomotiveId: LocomotiveId; costPerUnit: number }

type SessionOptions = ConstructorParameters<
    typeof GameSession<LwProjectedState, HydratedLwGameState>
>[0]

// A writable derived built on this starts again from `value` whenever `dependency` changes.
function resetWith<V>(_dependency: unknown, value: V): V {
    return value
}

export class LwGameSession extends GameSession<LwProjectedState, HydratedLwGameState> {
    private shipSelection: ShipSelection = $state({})
    private capacitySelection: CapacitySelection = $state({})
    private developSelection: DevelopSelection = $state({})

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                DevelopStageOrder,
                () => this.developSelection,
                (selection) => (this.developSelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection(
                CapacityStageOrder,
                () => this.capacitySelection,
                (selection) => (this.capacitySelection = selection)
            )
        )
        this.localSelections.register(
            undoableStagedSelection(
                ShipStageOrder,
                () => this.shipSelection,
                (selection) => (this.shipSelection = selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof LwPreferences> =
        this.createPreferences(LwPreferenceDefinition)

    kindPalette: KindPalette = $derived(this.preferences.values.kindPalette)

    colorBlind = $derived(this.kindPalette === KindPalette.ColorBlind)

    setColorBlind(colorBlind: boolean) {
        this.preferences.set({
            kindPalette: colorBlind ? KindPalette.ColorBlind : KindPalette.Standard
        })
    }

    // The state a shipment animation draws the board from, until the next state is shown.
    private boardStep: HydratedLwGameState | undefined = $derived(
        resetWith(this.gameState, undefined)
    )

    boardState: HydratedLwGameState = $derived(this.boardStep ?? this.gameState)

    showBoardStep(state: HydratedLwGameState) {
        this.boardStep = state
    }

    buyAndShip: boolean = $derived(readLwSetup(this.game.config).buyAndShip)

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(machineState: MachineState): boolean {
        return this.canAct && this.gameState.machineState === machineState
    }

    // The last finished round, from the shipments of that round to its Market Demands. The game
    // goes on without waiting: each viewer steps through it in their own time.
    private latestReview: RoundReview | undefined = $derived.by(() => {
        const actions = this.actions
        const marketIndex = actions.findLastIndex((action) => isAdjustMarket(action))
        const market = actions[marketIndex]
        const taxesIndex = actions.findLastIndex((action) => isPayTaxes(action))
        const taxes = actions[taxesIndex]
        if (!isAdjustMarket(market) || !market.metadata || !isPayTaxes(taxes) || !taxes.metadata) {
            return undefined
        }
        const roundStart =
            actions.slice(0, taxesIndex).findLastIndex((action) => isAdjustMarket(action)) + 1
        const ships = actions.slice(roundStart, taxesIndex).filter(isShip)
        const production = taxes.metadata.payments.map(({ playerId }) => {
            const records = ships
                .filter((ship) => ship.playerId === playerId)
                .flatMap((ship) => ship.metadata?.shipments ?? [])
            return {
                playerId,
                units: records.reduce((sum, record) => sum + record.units, 0),
                income: records.reduce((sum, record) => sum + record.income, 0)
            }
        })
        return {
            round: this.gameState.round() - 1,
            production,
            taxes: taxes.metadata,
            market: market.metadata,
            marketActionId: market.id
        }
    })

    private reviewId = $derived(this.latestReview?.marketActionId)

    private finishedReviewId: string | undefined = $state()

    reviewStage: ReviewStage = $derived(resetWith(this.reviewId, ReviewStage.Production))

    // The review shows in the live game until the viewer steps past Market Demands or skips it.
    roundReview: RoundReview | undefined = $derived(
        this.isViewingHistory || this.gameState.result || this.reviewId === this.finishedReviewId
            ? undefined
            : this.latestReview
    )

    advanceReview() {
        const next = REVIEW_STAGES[REVIEW_STAGES.indexOf(this.reviewStage) + 1]
        if (next) {
            this.reviewStage = next
        } else {
            this.finishReview()
        }
    }

    finishReview() {
        this.finishedReviewId = this.reviewId
    }

    displayName(playerId: string): string {
        return playerId === this.myPlayerId ? 'You' : this.getPlayerName(playerId)
    }

    // Locomotive Development

    developTargets: LocomotiveId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingIn(MachineState.Developing)
            ? this.gameState.developable(playerId)
            : []
    })

    // The locomotive chosen on the board; its picker asks to confirm, since a development that
    // rolls a die cannot be undone.
    chosenLocomotive: LocomotiveId | undefined = $derived.by(() => {
        const chosen = this.developSelection.locomotive?.value
        return chosen !== undefined && this.developTargets.includes(chosen) ? chosen : undefined
    })

    chooseLocomotive(locomotiveId: LocomotiveId) {
        if (this.developTargets.includes(locomotiveId)) {
            this.developSelection =
                this.chosenLocomotive === locomotiveId
                    ? {}
                    : chooseLocomotive(this.developSelection, locomotiveId)
        }
    }

    closeDevelopPicker() {
        if (this.chosenLocomotive !== undefined) {
            this.developSelection = {}
        }
    }

    // A picker whose row scrolls out of view would leave Undo a step the player cannot see.
    closeBoardPickers() {
        this.closeDevelopPicker()
        this.closeWerkPicker()
    }

    async develop(locomotiveId: LocomotiveId) {
        if (this.developTargets.includes(locomotiveId)) {
            await this.applyAction(this.createPlayerAction(Develop, { locomotiveId }))
        }
    }

    async passDevelopment() {
        await this.applyAction(this.createPlayerAction(PassDevelopment, {}))
    }

    // Production Capacity

    expanding = $derived(this.actingIn(MachineState.ExpandingCapacity))

    myPlants: Plant[] = $derived(
        this.myPlayerId ? (this.gameState.findPlayerState(this.myPlayerId)?.plants ?? []) : []
    )

    myCash: number = $derived(
        this.myPlayerId ? (this.gameState.findPlayerState(this.myPlayerId)?.cash ?? 0) : 0
    )

    // The purchases planned so far this turn. Nothing is bought until Done buying.
    private plan = $derived(this.expanding ? capacityPlan(this.capacitySelection) : undefined)

    capacitySteps: CapacityStep[] = $derived(this.plan?.steps ?? [])

    private stepCost(step: CapacityStep): number {
        return step.from
            ? this.gameState.shiftCost(step.from, step.locomotiveId)
            : locomotiveData(step.locomotiveId).productionCost
    }

    plannedSpend: number = $derived(
        this.capacitySteps.reduce((sum, step) => sum + this.stepCost(step), 0)
    )

    plannedCash: number = $derived(this.myCash - this.plannedSpend)

    // Each werk's units once the planned steps are made.
    plannedUnits: Map<LocomotiveId, number> = $derived(
        plannedUnits(this.myPlants, this.capacitySteps)
    )

    upgradeTargets(from: LocomotiveId): UpgradeTarget[] {
        return this.myPlants
            .filter((plant) => isNewer(plant.locomotiveId, from))
            .map((plant) => ({
                locomotiveId: plant.locomotiveId,
                costPerUnit: this.gameState.shiftCost(from, plant.locomotiveId)
            }))
    }

    canPlan(step: CapacityStep): boolean {
        return (
            this.expanding &&
            keepsWerksOpen(this.plannedUnits, step) &&
            this.stepCost(step) <= this.plannedCash
        )
    }

    planStep(step: CapacityStep) {
        if (this.canPlan(step)) {
            this.capacitySelection = addCapacityStep(this.capacitySelection, step)
        }
    }

    // The werk whose picker is open on the board.
    openedWerk: LocomotiveId | undefined = $derived.by(() => {
        const werk = this.expanding ? this.capacitySelection.werk?.value : undefined
        return werk !== undefined && this.myPlants.some((plant) => plant.locomotiveId === werk)
            ? werk
            : undefined
    })

    chooseWerk(locomotiveId: LocomotiveId) {
        if (
            !this.expanding ||
            !this.myPlants.some((plant) => plant.locomotiveId === locomotiveId)
        ) {
            return
        }
        this.capacitySelection =
            this.openedWerk === locomotiveId
                ? closeWerk(this.capacitySelection)
                : openWerk(this.capacitySelection, locomotiveId)
    }

    closeWerkPicker() {
        if (this.openedWerk !== undefined) {
            this.capacitySelection = closeWerk(this.capacitySelection)
        }
    }

    // Ticked beside Done buying and sent with it; Undo takes the tick back like a planned step.
    autoShip: boolean = $derived(this.plan?.autoShip ?? false)

    setAutoShip(autoShip: boolean) {
        if (this.expanding && autoShip !== this.autoShip) {
            this.capacitySelection = setAutoShip(this.capacitySelection, autoShip)
        }
    }

    // Submits the whole plan, in the order it was made, as the turn's one action.
    async finishExpanding() {
        const purchases = mergeCapacitySteps(this.capacitySteps)
        await this.applyAction(
            this.createPlayerAction(ExpandCapacity, {
                purchases,
                ...(this.autoShip ? { autoShip: true } : {})
            })
        )
    }

    // Production

    shipping = $derived(this.actingIn(MachineState.Shipping))

    shipments: Shipment[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.shipping ? this.gameState.shipments(playerId) : []
    })

    held: LocomotiveId[] = $derived(this.shipping ? (this.shipSelection.held?.value ?? []) : [])

    plannedShipments: Shipment[] = $derived(
        this.shipments.filter((shipment) => !this.held.includes(shipment.locomotiveId))
    )

    shipmentOf(locomotiveId: LocomotiveId): Shipment | undefined {
        return this.shipments.find((shipment) => shipment.locomotiveId === locomotiveId)
    }

    toggleHold(locomotiveId: LocomotiveId) {
        if (this.shipments.some((shipment) => shipment.locomotiveId === locomotiveId)) {
            this.shipSelection = toggleHeld(this.shipSelection, locomotiveId)
        }
    }

    async ship(shipments: Shipment[]) {
        await this.applyAction(
            this.createPlayerAction(Ship, {
                locomotiveIds: shipments.map((shipment) => shipment.locomotiveId)
            })
        )
    }
}
