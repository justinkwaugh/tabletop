import { GameSession, GameSessionMode } from '@tabletop/frontend-components'
import {
    ActionType,
    Cell,
    CENTER_COORDS,
    Direction,
    HydratedSolGameState,
    isLaunch,
    MachineState,
    SolGameState,
    StationType,
    Suit,
    Sundiver
} from '@tabletop/sol'
import {
    coordinatesToNumber,
    GameAction,
    OffsetCoordinates,
    Point,
    sameCoordinates
} from '@tabletop/common'
import { ActionCategory } from '$lib/definition/actionCategory.js'
import { getCellLayout } from '$lib/utils/cellLayouts.js'
import { ConvertType } from '$lib/definition/convertType.js'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

    chosenAction?: string = $state(undefined)
    chosenActionCategory?: ActionCategory = $state(undefined)
    chosenMothership?: string = $state(undefined)
    chosenNumDivers?: number = $state(undefined)
    chosenSource?: OffsetCoordinates = $state(undefined)
    chosenDestination?: OffsetCoordinates = $state(undefined)
    chosenConvertType?: ConvertType = $state(undefined)

    diverCellChoices?: number[] = $state(undefined)
    chosenDiverCell?: OffsetCoordinates = $state(undefined)
    chosenSecondDiverCell?: OffsetCoordinates = $state(undefined)

    midAction = $derived.by(() => {
        if (this.chosenSource) {
            return true
        }

        if (this.isMoving) {
            return this.chosenMothership || this.chosenNumDivers
        }

        if (this.chosenConvertType) {
            return true
        }

        return this.chosenActionCategory
    })
    isMoving = $derived(this.gameState.machineState === MachineState.Moving)
    isActivating = $derived(this.gameState.machineState === MachineState.Activating)
    isChoosingCard = $derived(this.gameState.machineState === MachineState.ChoosingCard)
    isSolarFlares = $derived(this.gameState.machineState === MachineState.SolarFlares)

    override initializeTimeline({
        to,
        from,
        timeline
    }: {
        to: SolGameState
        from?: SolGameState
        timeline: gsap.core.Timeline
    }): void {
        const isUndo = to.actionCount < (from?.actionCount ?? -1)
        // Add labels for different phases
        if (isUndo) {
            timeline.addLabel('mothership', 0)
            timeline.addLabel('cellsFadeOut', 'mothership+=0')
            timeline.addLabel('movingPieces', 'mothership+=0.1')
            timeline.addLabel('cellsFadeIn', 'cellsFadeOut+=0.3')
        } else {
            timeline.addLabel('cellsFadeOut', 0)
            timeline.addLabel('movingPieces', 'cellsFadeOut+=0.2')
            timeline.addLabel('cellsFadeIn', 'movingPieces+=0.3')
            timeline.addLabel('mothership', 'movingPieces+=0.1')
        }
    }

    override async onGameStateChange({
        to,
        from,
        timeline
    }: {
        to: SolGameState
        from?: SolGameState
        timeline: unknown
    }) {
        this.resetAction()
    }

    numPlayerCanMoveFromSource(): number {
        if (!this.isMyTurn || !this.myPlayerState) {
            return 0
        }

        let availableFromSource = 0
        if (this.chosenSource) {
            const cell = this.gameState.board.cellAt(this.chosenSource)
            if (!cell) {
                return 0
            }
            availableFromSource = this.gameState.board.sundiversForPlayer(
                this.myPlayerState.playerId,
                cell
            ).length
        } else if (this.chosenMothership) {
            availableFromSource = this.myPlayerState.numSundiversInHold()
        }

        return Math.min(this.myPlayerState.movementPoints, availableFromSource)
    }

    locationForDiverInCell(playerId: string, cell: Cell): Point | undefined {
        const cellLayout = getCellLayout(cell, this.numPlayers, this.gameState.board)

        const seen = new Set()
        const orderedPlayers = cell.sundivers.filter((diver) => {
            if (!seen.has(diver.playerId)) {
                seen.add(diver.playerId)
                return true
            }
            return false
        })
        const diverIndex = orderedPlayers.findIndex((d) => d.playerId === playerId)
        return cellLayout.divers[diverIndex]
    }

    locationForStationInCell(cell: Cell): Point | undefined {
        const cellLayout = getCellLayout(cell, this.numPlayers, this.gameState.board)
        return cellLayout.station?.point
    }

    validGateDestinations = $derived.by(() => {
        if (!this.myPlayer || this.chosenConvertType !== ConvertType.SolarGate) {
            return []
        }

        const gateKeys: number[] = []
        for (const cell of this.gameState.board) {
            if (this.gameState.board.canConvertGateAt(this.myPlayer.id, cell.coords)) {
                for (const destination of this.gameState.board.gateConversionDestinations(
                    cell.coords
                )) {
                    gateKeys.push(this.gameState.board.gateKey(cell.coords, destination))
                }
            }
        }
        return gateKeys
    })

    cancel() {}

    override willUndo(action: GameAction) {
        if (isLaunch(action)) {
            this.chosenActionCategory = ActionCategory.Move
            this.chosenMothership = action.mothership
            this.chosenNumDivers = action.numSundivers
            this.chosenDestination = undefined
        }
    }

    back() {
        if (this.chosenActionCategory === ActionCategory.Convert) {
            if (this.chosenDiverCell) {
                this.chosenDiverCell = undefined
            } else if (this.chosenSource) {
                this.diverCellChoices = undefined
                this.chosenSource = undefined
                this.chosenDestination = undefined
            } else if (this.chosenConvertType) {
                this.chosenConvertType = undefined
            } else {
                this.chosenActionCategory = undefined
            }
        } else if (this.chosenNumDivers) {
            this.chosenNumDivers = undefined
            if (this.numPlayerCanMoveFromSource() === 1) {
                if (this.chosenMothership) {
                    this.chosenMothership = undefined
                } else if (this.chosenSource) {
                    this.chosenSource = undefined
                }
            }
        } else if (this.chosenMothership) {
            this.chosenMothership = undefined
            if (!this.myPlayerState?.hasSundiversOnTheBoard()) {
                this.chosenActionCategory = undefined
            }
        } else if (this.chosenSource) {
            this.chosenSource = undefined
        } else if (this.chosenActionCategory && !this.isMoving) {
            this.chosenActionCategory = undefined
        } else if (this.chosenAction) {
            this.chosenAction = undefined
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenActionCategory = undefined
        this.chosenMothership = undefined
        this.chosenSource = undefined
        this.chosenNumDivers = undefined
        this.chosenConvertType = undefined
        this.chosenDestination = undefined
        this.diverCellChoices = undefined
        this.chosenDiverCell = undefined
        this.chosenSecondDiverCell = undefined
    }

    override shouldAutoStepAction(_action: GameAction) {
        return false
    }

    async launch() {
        if (
            !this.myPlayer ||
            !this.chosenMothership ||
            !this.chosenNumDivers ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid launch')
        }

        const action = {
            ...this.createBaseAction(ActionType.Launch),
            mothership: this.myPlayer.id,
            numSundivers: this.chosenNumDivers,
            destination: this.chosenDestination
        }

        await this.doAction(action)
    }

    async fly() {
        if (
            !this.myPlayer ||
            !this.chosenSource ||
            !this.chosenNumDivers ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid flight')
        }
        const cell = this.gameState.board.cellAt(this.chosenSource)
        const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
        if (playerDivers.length < this.chosenNumDivers) {
            throw new Error('Not enough divers')
        }

        // We want to take the last ones first
        const diverIds = playerDivers
            .toReversed()
            .slice(0, this.chosenNumDivers)
            .map((diver) => diver.id)

        const action = {
            ...this.createBaseAction(ActionType.Fly),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination
        }

        await this.doAction(action)
    }

    async hurl() {
        if (
            !this.myPlayer ||
            !this.chosenSource ||
            !this.chosenNumDivers ||
            !this.chosenDestination ||
            !sameCoordinates(this.chosenDestination, CENTER_COORDS)
        ) {
            throw new Error('Invalid hurl')
        }
        const cell = this.gameState.board.cellAt(this.chosenSource)
        const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
        if (playerDivers.length < this.chosenNumDivers) {
            throw new Error('Not enough divers')
        }

        // We want to take the last ones first
        const diverIds = playerDivers
            .toReversed()
            .slice(0, this.chosenNumDivers)
            .map((diver) => diver.id)

        const action = {
            ...this.createBaseAction(ActionType.Hurl),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination
        }

        await this.doAction(action)
    }

    async convertGate() {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenConvertType ||
            !this.chosenSource ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid gate conversion')
        }

        const sundiverIds = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        if (!firstSundiver) {
            throw new Error('No first sundiver to convert gate')
        }
        sundiverIds.push(firstSundiver.id)

        let secondSundiver
        if (!this.chosenDiverCell) {
            const sundiversByCoords: Map<
                number,
                { coords: OffsetCoordinates; divers: Sundiver[] }
            > = new Map()
            const secondCells = this.gameState.board.neighborsAt(this.chosenSource, Direction.Out)
            for (const cell of secondCells) {
                const divers = this.gameState.board.sundiversForPlayerAt(
                    this.myPlayer.id,
                    cell.coords
                )
                if (divers.length > 0) {
                    sundiversByCoords.set(coordinatesToNumber(cell.coords), {
                        coords: cell.coords,
                        divers
                    })
                }
            }

            if (sundiversByCoords.size > 1) {
                this.diverCellChoices = Array.from(sundiversByCoords.keys())
                return
            }

            secondSundiver = Array.from(sundiversByCoords.values()).at(-1)?.divers.at(-1)
        } else {
            secondSundiver = this.gameState.board
                .sundiversForPlayerAt(this.myPlayer.id, this.chosenDiverCell)
                .at(-1)
        }

        if (!secondSundiver) {
            throw new Error('No second sundiver to convert gate')
        }
        sundiverIds.push(secondSundiver.id)

        const action = {
            ...this.createBaseAction(ActionType.Convert),
            playerId: this.myPlayer.id,
            isGate: true,
            sundiverIds,
            coords: this.chosenSource,
            innerCoords: this.chosenDestination
        }

        await this.doAction(action)
    }

    async convertEnergyNode() {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenConvertType ||
            !this.chosenSource
        ) {
            throw new Error('Invalid conversion')
        }

        const ccwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.CounterClockwise)
            .at(-1)
        const cwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.Clockwise)
            .at(-1)

        if (!ccwNeighbor || !cwNeighbor) {
            throw new Error('No neighbors')
        }

        const firstSundiver = this.gameState.board
            .sundiversForPlayer(this.myPlayer.id, ccwNeighbor)
            .at(-1)
        const secondSundiver = this.gameState.board
            .sundiversForPlayer(this.myPlayer.id, cwNeighbor)
            .at(-1)

        if (!firstSundiver || !secondSundiver) {
            throw new Error('No sundivers to convert energy node')
        }
        const sundiverIds = [firstSundiver.id, secondSundiver.id]

        const action = {
            ...this.createBaseAction(ActionType.Convert),
            playerId: this.myPlayer.id,
            isGate: false,
            stationType: StationType.EnergyNode,
            sundiverIds,
            coords: this.chosenSource
        }

        await this.doAction(action)
    }

    async convertSundiverFoundry() {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenConvertType ||
            !this.chosenSource
        ) {
            throw new Error('Invalid conversion')
        }

        const ccwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.CounterClockwise)
            .at(-1)
        const cwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.Clockwise)
            .at(-1)

        if (!ccwNeighbor || !cwNeighbor) {
            throw new Error('No neighbors')
        }

        const sundiverIds = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        if (!firstSundiver) {
            throw new Error('No sundiver at local cell')
        }

        sundiverIds.push(firstSundiver.id)

        if (this.chosenDiverCell) {
            const secondSundiver = this.gameState.board
                .sundiversForPlayerAt(this.myPlayer.id, this.chosenDiverCell)
                .at(-1)
            if (!secondSundiver) {
                throw new Error('No second sundiver found')
            }
            sundiverIds.push(secondSundiver.id)
        } else {
            const secondSundiver = this.gameState.board
                .sundiversForPlayer(this.myPlayer.id, cwNeighbor)
                .at(-1)

            const alternateSecondSundiver = this.gameState.board
                .sundiversForPlayer(this.myPlayer.id, ccwNeighbor)
                .at(-1)

            if (secondSundiver && alternateSecondSundiver) {
                this.diverCellChoices = [
                    coordinatesToNumber(cwNeighbor.coords),
                    coordinatesToNumber(ccwNeighbor.coords)
                ]
                return
            }

            if (!secondSundiver && !alternateSecondSundiver) {
                throw new Error('No sundivers to convert energy node')
            }

            sundiverIds.push(secondSundiver?.id ?? alternateSecondSundiver?.id)
        }

        if (sundiverIds.length !== 2) {
            throw new Error('not enough sundivers to convert')
        }

        const action = {
            ...this.createBaseAction(ActionType.Convert),
            playerId: this.myPlayer.id,
            isGate: false,
            stationType: StationType.SundiverFoundry,
            sundiverIds,
            coords: this.chosenSource
        }

        await this.doAction(action)
    }

    async convertTransmitTower() {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenConvertType ||
            !this.chosenSource
        ) {
            throw new Error('Invalid tower conversion')
        }

        const sundiverIds = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        if (!firstSundiver) {
            throw new Error('No first sundiver to convert gate')
        }
        sundiverIds.push(firstSundiver.id)

        let secondSundiver
        if (!this.chosenDiverCell) {
            const sundiversByCoords: Map<
                number,
                { coords: OffsetCoordinates; divers: Sundiver[] }
            > = new Map()
            const secondCells = this.gameState.board.neighborsAt(this.chosenSource, Direction.Out)
            for (const cell of secondCells) {
                const divers = this.gameState.board.sundiversForPlayerAt(
                    this.myPlayer.id,
                    cell.coords
                )
                if (divers.length > 0) {
                    sundiversByCoords.set(coordinatesToNumber(cell.coords), {
                        coords: cell.coords,
                        divers
                    })
                }
            }

            if (sundiversByCoords.size > 1) {
                this.diverCellChoices = Array.from(sundiversByCoords.keys())
                return
            }

            secondSundiver = Array.from(sundiversByCoords.values()).at(-1)?.divers.at(-1)
        } else {
            secondSundiver = this.gameState.board
                .sundiversForPlayerAt(this.myPlayer.id, this.chosenDiverCell)
                .at(-1)
        }

        if (!secondSundiver) {
            throw new Error('No second sundiver to convert gate')
        }
        sundiverIds.push(secondSundiver.id)

        let thirdSundiver
        if (!this.chosenSecondDiverCell) {
            if (!this.chosenDiverCell) {
                throw new Error('No chosen diver cell for second sundiver')
            }
            const sundiversByCoords: Map<
                number,
                { coords: OffsetCoordinates; divers: Sundiver[] }
            > = new Map()
            const thirdCells = this.gameState.board.neighborsAt(this.chosenDiverCell, Direction.Out)
            for (const cell of thirdCells) {
                const divers = this.gameState.board.sundiversForPlayerAt(
                    this.myPlayer.id,
                    cell.coords
                )
                if (divers.length > 0) {
                    sundiversByCoords.set(coordinatesToNumber(cell.coords), {
                        coords: cell.coords,
                        divers
                    })
                }
            }

            if (sundiversByCoords.size > 1) {
                this.diverCellChoices = Array.from(sundiversByCoords.keys())
                return
            }

            thirdSundiver = Array.from(sundiversByCoords.values()).at(-1)?.divers.at(-1)
        } else {
            thirdSundiver = this.gameState.board
                .sundiversForPlayerAt(this.myPlayer.id, this.chosenSecondDiverCell)
                .at(-1)
        }

        if (!thirdSundiver) {
            throw new Error('No third sundiver to convert gate')
        }
        sundiverIds.push(thirdSundiver.id)

        const action = {
            ...this.createBaseAction(ActionType.Convert),
            playerId: this.myPlayer.id,
            isGate: false,
            stationType: StationType.TransmitTower,
            sundiverIds,
            coords: this.chosenSource,
            innerCoords: this.chosenDestination
        }

        await this.doAction(action)
    }

    async activateStation() {
        if (!this.myPlayer || !this.chosenSource) {
            throw new Error('Invalid activation')
        }
        const cell = this.gameState.board.cellAt(this.chosenSource)
        const station = cell.station

        if (!station) {
            throw new Error('No station to activate')
        }

        if (!this.isSolarFlares) {
            const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
            if (playerDivers.length < 1) {
                throw new Error('Not enough divers')
            }
        }

        const action = {
            ...this.createBaseAction(ActionType.Activate),
            playerId: this.myPlayer.id,
            stationId: station.id,
            coords: cell.coords,
            start: this.chosenSource
        }

        await this.doAction(action)
    }

    async activateBonus() {
        if (!this.myPlayer || !this.isActivating) {
            throw new Error('Invalid activate bonus')
        }
        const action = {
            ...this.createBaseAction(ActionType.ActivateBonus),
            playerId: this.myPlayer.id
        }

        await this.doAction(action)
    }

    async pass() {
        if (
            !this.myPlayer ||
            (!this.isActivating && !this.isMoving && !this.isSolarFlares && !this.isChoosingCard)
        ) {
            throw new Error('Invalid pass')
        }
        const action = {
            ...this.createBaseAction(ActionType.Pass),
            playerId: this.myPlayer.id
        }

        await this.doAction(action)
    }

    async chooseCard(suit: Suit) {
        if (!this.myPlayer || !this.isChoosingCard) {
            throw new Error('Invalid choose card')
        }
        const action = {
            ...this.createBaseAction(ActionType.ChooseCard),
            playerId: this.myPlayer.id,
            suit
        }

        await this.doAction(action)
    }

    async doAction(action: GameAction) {
        if (!this.isPlayable) {
            return
        }

        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
        }
    }
}
