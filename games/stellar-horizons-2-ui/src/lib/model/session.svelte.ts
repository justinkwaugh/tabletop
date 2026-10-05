import { GameSession } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    BuildShip,
    BuySettlements,
    ChooseFaction,
    ChooseSurveyWorld,
    ChooseTerraformWorld,
    CloneSettlement,
    DevelopTech,
    EndStep,
    Explore,
    LoadSettlement,
    MachineState,
    MoveShip,
    PassTerraform,
    RepairMethod,
    RepairShip,
    ScrapShip,
    Terraform,
    TransferSettlements,
    TurnStep,
    UnloadSettlements,
    canExplore,
    hasArrived,
    isTechAvailable,
    moveOptions,
    type Faction,
    type HydratedStellarHorizonsGameState,
    type MoveOption,
    type ShipState,
    type StellarHorizonsProjectedState,
    type TechId
} from '@tabletop/stellar-horizons-2'
import {
    selectedShipId,
    selectedTechId,
    shipSelection,
    techSelection,
    type Selection
} from './selection.js'

const SHIP_SELECTION_STEPS: readonly TurnStep[] = [
    TurnStep.Build,
    TurnStep.Cargo,
    TurnStep.Movement,
    TurnStep.Exploration
]

export interface ShipClump {
    systemId: string
    playerId: string
    ships: ShipState[]
}

export class StellarHorizonsGameSession extends GameSession<
    StellarHorizonsProjectedState,
    HydratedStellarHorizonsGameState
> {
    private selection: Selection | undefined = $state()
    private inspected: { systemId: string; playerId: string } | undefined = $state()
    private focus: { systemId: string; closing: boolean } | undefined = $state()

    myPlayerId: string | undefined = $derived(this.myPlayer?.id)

    canAct: boolean = $derived(this.isMyTurn && !this.isViewingHistory)

    myStep: TurnStep | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        if (!playerId || this.gameState.machineState !== MachineState.PlayingTurn) {
            return undefined
        }
        return this.gameState.findPlayerState(playerId)?.step
    })

    actingStep: TurnStep | undefined = $derived(this.canAct ? this.myStep : undefined)

    selectedShip: ShipState | undefined = $derived.by(() => {
        const shipId = selectedShipId(this.selection)
        const playerId = this.myPlayerId
        const step = this.actingStep
        if (!shipId || !playerId || !step || !SHIP_SELECTION_STEPS.includes(step)) {
            return undefined
        }
        return this.gameState.playerShip(playerId, shipId)
    })

    selectedTech: TechId | undefined = $derived.by(() => {
        const techId = selectedTechId(this.selection)
        const playerId = this.myPlayerId
        if (!techId || !playerId || this.actingStep !== TurnStep.Development) {
            return undefined
        }
        return isTechAvailable(this.gameState, playerId, techId) ? techId : undefined
    })

    moveTargets: MoveOption[] = $derived.by(() => {
        const ship = this.selectedShip
        if (!ship || this.actingStep !== TurnStep.Movement) {
            return []
        }
        return moveOptions(this.gameState, ship)
    })

    selectableShipIds: string[] = $derived.by(() => {
        const playerId = this.myPlayerId
        const step = this.actingStep
        if (!playerId || !step || !SHIP_SELECTION_STEPS.includes(step)) {
            return []
        }
        return this.gameState
            .shipsOf(playerId)
            .filter((ship) => this.isShipActionable(ship, step))
            .map((ship) => ship.shipId)
    })

    private isShipActionable(ship: ShipState, step: TurnStep): boolean {
        switch (step) {
            case TurnStep.Movement:
                return hasArrived(ship)
            case TurnStep.Exploration:
                return canExplore(this.gameState, ship)
            default:
                return true
        }
    }

    inspectedClump: ShipClump | undefined = $derived.by(() => {
        const inspected = this.inspected
        if (!inspected) {
            return undefined
        }
        const ships = this.gameState.ships.filter(
            (ship) => ship.systemId === inspected.systemId && ship.playerId === inspected.playerId
        )
        return ships.length > 0 ? { ...inspected, ships } : undefined
    })

    toggleClump(systemId: string, playerId: string) {
        const current = this.inspectedClump
        this.inspected =
            current?.systemId === systemId && current.playerId === playerId
                ? undefined
                : { systemId, playerId }
    }

    closeClump() {
        this.inspected = undefined
    }

    focusedSystemId: string | undefined = $derived(
        this.focus && this.gameState.isSystemInPlay(this.focus.systemId)
            ? this.focus.systemId
            : undefined
    )

    focusClosing: boolean = $derived(this.focus?.closing ?? false)

    focusSystem(systemId: string) {
        this.closeClump()
        this.focus = { systemId, closing: false }
    }

    leaveFocus() {
        if (this.focus) {
            this.focus = { ...this.focus, closing: true }
        }
    }

    finishLeavingFocus() {
        this.focus = undefined
    }

    selectShipFromClump(shipId: string) {
        this.closeClump()
        this.selectShip(shipId)
    }

    hasManualSelection(): boolean {
        return this.selection !== undefined
    }

    selectShip(shipId: string) {
        this.selection =
            selectedShipId(this.selection) === shipId ? undefined : shipSelection(shipId)
    }

    selectTech(techId: TechId) {
        this.selection =
            selectedTechId(this.selection) === techId ? undefined : techSelection(techId)
    }

    clearSelection() {
        this.selection = undefined
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.clearSelection()
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = undefined
    }

    private inTurn(action: GameAction): GameAction {
        action.simultaneousGroupId = `turn-${this.gameState.year}`
        return action
    }

    private async commit(type: ActionType, action: GameAction) {
        if (!this.validActionTypes.includes(type)) {
            return
        }
        await this.applyAction(action)
    }

    async chooseFaction(faction: Faction) {
        await this.commit(
            ActionType.ChooseFaction,
            this.createPlayerAction(ChooseFaction, { faction })
        )
    }

    async buildShip(shipId: string, systemId: string) {
        await this.commit(
            ActionType.BuildShip,
            this.inTurn(this.createPlayerAction(BuildShip, { shipId, systemId }))
        )
    }

    async repairShip(shipId: string, method: RepairMethod, points: number) {
        await this.commit(
            ActionType.RepairShip,
            this.inTurn(this.createPlayerAction(RepairShip, { shipId, method, points }))
        )
    }

    async scrapShip(shipId: string) {
        this.clearSelection()
        await this.commit(
            ActionType.ScrapShip,
            this.inTurn(this.createPlayerAction(ScrapShip, { shipId }))
        )
    }

    async cloneSettlement(systemId: string) {
        await this.commit(
            ActionType.CloneSettlement,
            this.inTurn(this.createPlayerAction(CloneSettlement, { systemId }))
        )
    }

    async buySettlements(shipId: string, count: number) {
        await this.commit(
            ActionType.BuySettlements,
            this.inTurn(this.createPlayerAction(BuySettlements, { shipId, count }))
        )
    }

    async loadSettlement(shipId: string) {
        await this.commit(
            ActionType.LoadSettlement,
            this.inTurn(this.createPlayerAction(LoadSettlement, { shipId }))
        )
    }

    async transferSettlements(fromShipId: string, toShipId: string, count: number) {
        await this.commit(
            ActionType.TransferSettlements,
            this.inTurn(
                this.createPlayerAction(TransferSettlements, { fromShipId, toShipId, count })
            )
        )
    }

    async unloadSettlements(shipId: string, count: number) {
        await this.commit(
            ActionType.UnloadSettlements,
            this.inTurn(this.createPlayerAction(UnloadSettlements, { shipId, count }))
        )
    }

    async moveSelectedShip(systemId: string) {
        const ship = this.selectedShip
        if (!ship || !this.moveTargets.some((target) => target.systemId === systemId)) {
            return
        }
        this.clearSelection()
        await this.commit(
            ActionType.MoveShip,
            this.inTurn(this.createPlayerAction(MoveShip, { shipId: ship.shipId, systemId }))
        )
    }

    async explore(shipId: string) {
        this.clearSelection()
        await this.commit(
            ActionType.Explore,
            this.inTurn(this.createPlayerAction(Explore, { shipId }))
        )
    }

    async developTech(techId: TechId, markers: number[], cash: number) {
        this.clearSelection()
        await this.commit(
            ActionType.DevelopTech,
            this.inTurn(this.createPlayerAction(DevelopTech, { techId, markers, cash }))
        )
    }

    async endStep() {
        const step = this.myStep
        if (!step) {
            return
        }
        this.clearSelection()
        await this.commit(
            ActionType.EndStep,
            this.inTurn(this.createPlayerAction(EndStep, { step }))
        )
    }

    async chooseSurveyWorld(slot: number | undefined) {
        await this.commit(
            ActionType.ChooseSurveyWorld,
            this.createPlayerAction(ChooseSurveyWorld, { slot })
        )
    }

    async terraform(systemId: string, slot: number) {
        await this.commit(
            ActionType.Terraform,
            this.createPlayerAction(Terraform, { systemId, slot })
        )
    }

    async passTerraform() {
        await this.commit(ActionType.PassTerraform, this.createPlayerAction(PassTerraform, {}))
    }

    async chooseTerraformWorld(tileId: string | undefined, removedTileIds: string[]) {
        await this.commit(
            ActionType.ChooseTerraformWorld,
            this.createPlayerAction(ChooseTerraformWorld, { tileId, removedTileIds })
        )
    }
}
