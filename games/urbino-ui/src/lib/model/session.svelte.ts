import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    BuildingType,
    MachineState,
    PlaceArchitect,
    ChooseFirstPlayer,
    PlaceBuilding,
    RepositionArchitect,
    Pass,
    isRepositionArchitect,
    isPlaceBuilding,
    getValidPlacements,
    getValidPlacementsForType,
    hasAnyValidPlacement,
    isValidRepositionTarget,
    type HydratedUrbinoGameState,
    type UrbinoGameState,
} from '@tabletop/urbino'

export class UrbinoGameSession extends GameSession<UrbinoGameState, HydratedUrbinoGameState> {
    selectedBuildingType: BuildingType | undefined = $state()
    selectedArchitectIndex: number | undefined = $state()

    isPlacingArchitects = $derived(
        this.gameState.machineState === MachineState.PlacingArchitects
    )

    isChoosingFirstPlayer = $derived(
        this.gameState.machineState === MachineState.ChoosingFirstPlayer
    )

    isTakingTurn = $derived(this.gameState.machineState === MachineState.TakingTurn)

    canPlaceArchitect = $derived(
        this.isPlacingArchitects &&
            this.validActionTypes.includes(ActionType.PlaceArchitect) &&
            !!this.myPlayer?.id
    )

    canChooseFirstPlayer = $derived(
        this.isChoosingFirstPlayer &&
            this.validActionTypes.includes(ActionType.ChooseFirstPlayer) &&
            !!this.myPlayer?.id
    )

    canRepositionArchitect = $derived(
        this.isTakingTurn &&
            this.validActionTypes.includes(ActionType.RepositionArchitect) &&
            !!this.myPlayer?.id
    )

    canUndoReposition = $derived(
        this.isTakingTurn &&
            this.gameState.hasRepositionedThisTurn &&
            !!this.undoableAction &&
            isRepositionArchitect(this.undoableAction)
    )

    canUndoPlacement = $derived(
        !!this.undoableAction && isPlaceBuilding(this.undoableAction)
    )

    canPlaceBuilding = $derived(
        this.isTakingTurn &&
            this.validActionTypes.includes(ActionType.PlaceBuilding) &&
            !!this.myPlayer?.id
    )

    canPass = $derived(
        this.isTakingTurn &&
            this.validActionTypes.includes(ActionType.Pass) &&
            !!this.myPlayer?.id
    )

    validPlacementSquares: number[] = $derived.by(() => {
        if (!this.canPlaceBuilding || !this.myPlayer?.id) return []
        const player = this.gameState.players.find((p) => p.playerId === this.myPlayer!.id)
        if (!player) return []
        if (this.selectedBuildingType) {
            return getValidPlacementsForType(
                this.gameState.board,
                this.gameState.architects,
                this.myPlayer.id,
                this.selectedBuildingType,
                this.gameState.monumentsVariant
            )
        }
        return getValidPlacements(this.gameState.board, this.gameState.architects, this.myPlayer.id, {
            houses: player.houses,
            palaces: player.palaces,
            towers: player.towers,
        }, this.gameState.monumentsVariant)
    })

    validRepositionSquares: number[] = $derived.by(() => {
        if (!this.canRepositionArchitect || this.selectedArchitectIndex === undefined) return []
        const player = this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
        if (!player) return []
        const valid: number[] = []
        for (let i = 0; i < 81; i++) {
            if (!isValidRepositionTarget(this.gameState.board, this.gameState.architects, this.selectedArchitectIndex, i)) continue
            const newArchitects = [...this.gameState.architects]
            newArchitects[this.selectedArchitectIndex] = i
            if (hasAnyValidPlacement(
                this.gameState.board,
                newArchitects,
                this.myPlayer!.id,
                { houses: player.houses, palaces: player.palaces, towers: player.towers },
                this.gameState.monumentsVariant
            )) {
                valid.push(i)
            }
        }
        return valid
    })

    validArchitectPlacementSquares: number[] = $derived.by(() => {
        if (!this.canPlaceArchitect) return []
        const valid: number[] = []
        for (let i = 0; i < 81; i++) {
            if (
                this.gameState.board[i] === null &&
                i !== this.gameState.architects[0] &&
                i !== this.gameState.architects[1]
            ) {
                valid.push(i)
            }
        }
        return valid
    })

    resetAction() {
        this.selectedBuildingType = undefined
        this.selectedArchitectIndex = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    selectBuildingType(type: BuildingType) {
        if (!this.canPlaceBuilding) return
        this.selectedBuildingType = this.selectedBuildingType === type ? undefined : type
    }

    selectArchitect(index: number) {
        if (!this.canRepositionArchitect) return
        this.selectedArchitectIndex = this.selectedArchitectIndex === index ? undefined : index
    }

    async placeArchitect(position: number) {
        if (!this.canPlaceArchitect || !this.myPlayer?.id) return
        const action = this.createPlayerAction(PlaceArchitect, { position })
        await this.applyAction(action)
    }

    async chooseFirstPlayer(startingPlayerId: string) {
        if (!this.canChooseFirstPlayer || !this.myPlayer?.id) return
        const action = this.createPlayerAction(ChooseFirstPlayer, { startingPlayerId })
        await this.applyAction(action)
    }

    async repositionArchitect(architectIndex: number, position: number) {
        if (!this.canRepositionArchitect || !this.myPlayer?.id) return
        this.selectedArchitectIndex = undefined
        const action = this.createPlayerAction(RepositionArchitect, { architectIndex, position })
        await this.applyAction(action)
    }

    async placeBuilding(position: number, buildingType: BuildingType) {
        if (!this.canPlaceBuilding || !this.myPlayer?.id) return
        this.selectedBuildingType = undefined
        const action = this.createPlayerAction(PlaceBuilding, { position, buildingType })
        await this.applyAction(action)
    }

    async pass() {
        if (!this.canPass || !this.myPlayer?.id) return
        const action = this.createPlayerAction(Pass, {})
        await this.applyAction(action)
    }
}
