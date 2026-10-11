import { GameSession } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    BuildShip,
    ChooseFaction,
    ChooseSurveyWorld,
    ChooseTerraformWorld,
    CloneSettlement,
    DevelopTech,
    EndStep,
    Explore,
    MachineState,
    MoveShip,
    PassTerraform,
    RepairMethod,
    RepairShip,
    ScrapShip,
    Terraform,
    TransferCargo,
    TurnStep,
    canExplore,
    cargoPartners,
    cargoTransferLimits,
    carriesCargo,
    hasArrived,
    isTechAvailable,
    moveOptions,
    sameCargoPartner,
    type CargoPartner,
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

interface CargoDraft {
    partner: CargoPartner
    settlements: number
}

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
    private cargoDraft: CargoDraft | undefined = $state()
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

    cargoShip: ShipState | undefined = $derived.by(() => {
        const ship = this.selectedShip
        return ship && this.actingStep === TurnStep.Cargo && carriesCargo(this.gameState, ship)
            ? ship
            : undefined
    })

    cargoPartners: CargoPartner[] = $derived(
        this.cargoShip ? cargoPartners(this.gameState, this.cargoShip) : []
    )

    cargoPartner: CargoPartner | undefined = $derived.by(() => {
        const chosen = this.cargoDraft?.partner
        const kept = chosen
            ? this.cargoPartners.find((partner) => sameCargoPartner(partner, chosen))
            : undefined
        return kept ?? this.cargoPartners.at(0)
    })

    draftedSettlements: number = $derived.by(() => {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        const draft = this.cargoDraft
        if (!ship || !partner || !draft || !sameCargoPartner(draft.partner, partner)) {
            return 0
        }
        return this.isWithinCargoLimits(ship, partner, draft.settlements) ? draft.settlements : 0
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
        this.select(selectedShipId(this.selection) === shipId ? undefined : shipSelection(shipId))
    }

    // Choosing a ship from the action panel also shows where it is: the map zooms into its
    // system. Choosing it again clears the choice and returns to the map.
    locateShip(shipId: string) {
        const playerId = this.myPlayerId
        const ship = playerId ? this.gameState.playerShip(playerId, shipId) : undefined
        if (!ship) {
            return
        }
        if (selectedShipId(this.selection) === shipId) {
            this.select(undefined)
            this.leaveFocus()
            return
        }
        this.select(shipSelection(shipId))
        this.focusSystem(ship.systemId)
    }

    selectTech(techId: TechId) {
        this.select(selectedTechId(this.selection) === techId ? undefined : techSelection(techId))
    }

    clearSelection() {
        this.select(undefined)
    }

    chooseCargoPartner(partner: CargoPartner) {
        this.cargoDraft = { partner, settlements: 0 }
    }

    draftCargo(direction: 1 | -1) {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        if (!ship || !partner) {
            return
        }
        const settlements = this.draftedSettlements + direction
        if (this.isWithinCargoLimits(ship, partner, settlements)) {
            this.cargoDraft = { partner, settlements }
        }
    }

    async commitCargoDraft() {
        const ship = this.cargoShip
        const partner = this.cargoPartner
        const settlements = this.draftedSettlements
        if (!ship || !partner || settlements === 0) {
            return
        }
        this.cargoDraft = { partner, settlements: 0 }
        await this.commit(
            ActionType.TransferCargo,
            this.inTurn(
                this.createPlayerAction(TransferCargo, {
                    shipId: ship.shipId,
                    partner,
                    settlements
                })
            )
        )
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.clearSelection()
            return
        }
        await super.undo()
    }

    resetAction() {
        this.select(undefined)
    }

    private select(selection: Selection | undefined) {
        this.selection = selection
        this.cargoDraft = undefined
    }

    private isWithinCargoLimits(
        ship: ShipState,
        partner: CargoPartner,
        settlements: number
    ): boolean {
        const limits = cargoTransferLimits(this.gameState, ship, partner)
        return settlements <= limits.load && -settlements <= limits.unload
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
        // Movement starts from the whole map, so every destination is in view.
        if (this.myStep === TurnStep.Movement) {
            this.leaveFocus()
        }
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
