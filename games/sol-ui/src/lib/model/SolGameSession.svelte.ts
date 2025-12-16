import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    Card,
    Cell,
    CENTER_COORDS,
    Direction,
    EffectType,
    HydratedSolGameState,
    isActivateEffect,
    isLaunch,
    MachineState,
    SolarGate,
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
import { getCellLayout } from '$lib/utils/cellLayouts.js'
import { ConvertType } from '$lib/definition/convertType.js'
import { getMothershipSpotPoint, getSpaceCentroid } from '$lib/utils/boardGeometry.js'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

    chosenAction?: string = $state(undefined)
    chosenMothership?: string = $state(undefined)
    chosenNumDivers?: number = $state(undefined)
    chosenSource?: OffsetCoordinates = $state(undefined)
    chosenDestination?: OffsetCoordinates = $state(undefined)
    chosenConvertType?: ConvertType = $state(undefined)
    chosenGates?: number[] = $state(undefined)
    chosenDiverCell?: OffsetCoordinates = $state(undefined)
    chosenSecondDiverCell?: OffsetCoordinates = $state(undefined)

    gateChoices?: number[] = $state(undefined)
    diverCellChoices?: number[] = $state(undefined)

    clusterChoice?: boolean = $state(undefined)
    pillarGuess?: Suit = $state(undefined)
    juggernautStationId?: string = $state(undefined)
    hatchLocation?: OffsetCoordinates = $state(undefined)
    hatchTarget?: string = $state(undefined)
    teleportChoice?: boolean = $state(undefined)
    accelerationAmount?: number = $state(undefined)

    movementPickerLocation = $derived.by(() => {
        if (this.chosenSource) {
            return getSpaceCentroid(this.numPlayers, this.chosenSource)
        } else if (this.chosenMothership) {
            const mothershipIndex = this.gameState.board.motherships[this.chosenMothership]
            return getMothershipSpotPoint(this.numPlayers, mothershipIndex)
        }

        return { x: 0, y: 0 }
    })

    drawnCards: Card[] = $derived.by(() => {
        const currentPlayer = this.gameState.turnManager.currentTurn()?.playerId
        if (!currentPlayer) {
            return []
        }
        const currentPlayerState = this.gameState.getPlayerState(currentPlayer!)
        if (!currentPlayerState || !currentPlayerState.drawnCards) {
            return []
        }

        const drawnCards = structuredClone(currentPlayerState.drawnCards)
        if (this.gameState.machineState === MachineState.SolarFlares) {
            return drawnCards.filter((card) => card.suit === Suit.Flare)
        }
        return drawnCards
    })

    midAction = $derived.by(() => {
        if (this.isHatching) {
            return this.hatchLocation
        }

        if (this.chosenSource) {
            return true
        }

        if (this.isMoving) {
            return this.chosenMothership || this.chosenNumDivers || this.juggernautStationId
        }

        if (this.isConverting && this.chosenConvertType) {
            return true
        }
    })
    isMoving = $derived(this.gameState.machineState === MachineState.Moving)
    isConverting = $derived(this.gameState.machineState === MachineState.Converting)
    isActivating = $derived(this.gameState.machineState === MachineState.Activating)
    isCheckingEffect = $derived(this.gameState.machineState === MachineState.CheckEffect)
    isChoosingCard = $derived(this.gameState.machineState === MachineState.ChoosingCard)
    isSolarFlares = $derived(this.gameState.machineState === MachineState.SolarFlares)
    isDrawingCards = $derived(this.gameState.machineState === MachineState.DrawingCards)
    isHatching = $derived(this.gameState.machineState === MachineState.Hatching)
    isAccelerating = $derived(this.gameState.machineState === MachineState.Accelerating)

    acting = $derived(
        this.isMoving ||
            this.isConverting ||
            this.isActivating ||
            this.isChoosingCard ||
            this.isSolarFlares ||
            this.isDrawingCards ||
            this.isCheckingEffect ||
            this.isHatching ||
            this.isAccelerating
    )

    forcedCallToAction = $state<string | undefined>(undefined)
    movingCubeIds: string[] = $state([])

    skipReset = false

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedSolGameState
        from?: HydratedSolGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        // Activating an effect is a state change noop really, so we should
        // not reset the action before the state change.  This allows for the user to do it
        // in the middle of other actions like moving.  Undo may be an issue here though.
        if (isActivateEffect(action)) {
            if (action.effect === EffectType.Hyperdrive && (this.chosenNumDivers ?? 0) > 1) {
                this.chosenNumDivers = 1
            }
            if (action.effect !== EffectType.Motivate) {
                this.skipReset = true
            }
            if (action.effect === EffectType.Hatch) {
                this.skipReset = true
            }
        }
    }

    override beforeNewState(): void {
        if (!this.skipReset) {
            this.resetAction()
        }
        this.skipReset = false
    }

    numPlayerCanMoveFromSource(): number {
        if (!this.isMyTurn || !this.myPlayerState) {
            return 0
        }

        let availableFromSource = 0
        if (this.chosenSource) {
            const cell = this.gameState.board.cellAt(this.chosenSource)
            availableFromSource = this.gameState.board.sundiversForPlayer(
                this.myPlayerState.playerId,
                cell
            ).length
        } else if (this.chosenMothership) {
            availableFromSource = this.myPlayerState.numSundiversInHold()
        }

        if (
            availableFromSource > 1 &&
            (this.gameState.activeEffect === EffectType.Hyperdrive ||
                this.gameState.activeEffect === EffectType.Puncture)
        ) {
            availableFromSource = 1
        }

        return Math.min(this.myPlayerState.movementPoints, availableFromSource)
    }

    canMoveStationFromSource(): boolean {
        return (
            this.myPlayer !== undefined &&
            this.chosenSource !== undefined &&
            this.gameState.activeEffect === EffectType.Juggernaut &&
            this.gameState.board.hasStationAt(this.chosenSource, this.myPlayer.id)
        )
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
            this.chosenMothership = action.mothership
            this.chosenNumDivers = action.numSundivers
            this.chosenDestination = undefined
        }
    }

    back() {
        if (this.isHatching) {
            this.hatchLocation = undefined
        } else if (this.isConverting) {
            if (this.chosenDiverCell) {
                this.chosenDiverCell = undefined
            } else if (this.chosenSource) {
                this.diverCellChoices = undefined
                this.chosenSource = undefined
                this.chosenDestination = undefined
            } else if (this.chosenConvertType) {
                this.chosenConvertType = undefined
            }
        } else if (this.teleportChoice !== undefined) {
            this.teleportChoice = undefined
        } else if (this.clusterChoice !== undefined) {
            this.clusterChoice = undefined
        } else if (this.chosenNumDivers) {
            this.chosenNumDivers = undefined
            if (this.numPlayerCanMoveFromSource() === 1) {
                if (this.chosenMothership) {
                    this.chosenMothership = undefined
                } else if (this.chosenSource) {
                    this.chosenSource = undefined
                }
            }
        } else if (this.juggernautStationId) {
            this.juggernautStationId = undefined
            this.chosenSource = undefined
        } else if (this.chosenMothership) {
            this.chosenMothership = undefined
        } else if (this.chosenSource) {
            this.chosenSource = undefined
        } else if (this.chosenAction) {
            this.chosenAction = undefined
        }
    }

    resetAction() {
        this.chosenAction = undefined
        this.chosenMothership = undefined
        this.chosenSource = undefined
        this.chosenNumDivers = undefined
        this.chosenConvertType = undefined
        this.chosenDestination = undefined

        this.chosenGates = undefined
        this.chosenDiverCell = undefined
        this.chosenSecondDiverCell = undefined

        this.diverCellChoices = undefined
        this.gateChoices = undefined

        this.clusterChoice = undefined
        this.pillarGuess = undefined
        this.juggernautStationId = undefined
        this.hatchLocation = undefined
        this.hatchTarget = undefined
        this.teleportChoice = undefined
        this.accelerationAmount = undefined

        this.forcedCallToAction = undefined
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
            mothership: this.chosenMothership,
            numSundivers: this.chosenNumDivers,
            destination: this.chosenDestination
        }

        await this.doAction(action)
    }

    async fly() {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenSource ||
            (!this.chosenNumDivers && !this.juggernautStationId) ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid flight')
        }

        const cell = this.gameState.board.cellAt(this.chosenSource)

        const chosenGates = (this.chosenGates ?? []).map((key) => {
            const gate = this.gameState.board.gates[key]
            if (!gate) {
                throw new Error('Invalid gate for flight')
            }
            return gate
        })

        if (
            !this.teleportChoice &&
            this.gameState.board.requiresGateBetween(this.chosenSource, this.chosenDestination)
        ) {
            do {
                const gates = this.getGateChoices(
                    this.chosenSource,
                    this.chosenDestination,
                    chosenGates
                )
                if (gates.length > 1) {
                    this.gateChoices = gates.map((gate) =>
                        this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                    )
                    return
                } else if (gates.length === 1) {
                    // If we want to allow non-direct flights... this will happen
                    if (this.chosenSource.row === this.chosenDestination.row) {
                        // We could just go straight there....
                        this.gateChoices = gates.map((gate) =>
                            this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                        )
                        return
                    }

                    if (!this.chosenGates) {
                        this.chosenGates = []
                    }
                    this.chosenGates.push(
                        this.gameState.board.gateKey(gates[0].outerCoords!, gates[0].innerCoords!)
                    )
                    chosenGates.push(gates[0])
                } else {
                    break
                }
            } while (true)
        }

        const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
        // We want to take the last ones first
        const diverIds = this.juggernautStationId
            ? []
            : playerDivers
                  .toReversed()
                  .slice(0, this.chosenNumDivers)
                  .map((diver) => diver.id)

        const action = {
            ...this.createBaseAction(ActionType.Fly),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination,
            gates: chosenGates,
            cluster: this.clusterChoice ?? false,
            teleport: this.teleportChoice ?? false,
            stationId: this.juggernautStationId
        }

        await this.doAction(action)
    }

    async hurl() {
        if (
            !this.myPlayer ||
            !this.chosenSource ||
            (!this.chosenNumDivers && !this.juggernautStationId) ||
            !this.chosenDestination ||
            !sameCoordinates(this.chosenDestination, CENTER_COORDS)
        ) {
            throw new Error('Invalid hurl')
        }
        const cell = this.gameState.board.cellAt(this.chosenSource)

        const chosenGates = (this.chosenGates ?? []).map((key) => {
            const gate = this.gameState.board.gates[key]
            if (!gate) {
                throw new Error('Invalid gate for flight')
            }
            return gate
        })

        const gates = this.getGateChoices(this.chosenSource, this.chosenDestination, chosenGates)

        if (gates.length > 0) {
            this.gateChoices = gates.map((gate) =>
                this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
            )
            return
        }

        const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
        // We want to take the last ones first
        const diverIds = this.juggernautStationId
            ? []
            : playerDivers
                  .toReversed()
                  .slice(0, this.chosenNumDivers)
                  .map((diver) => diver.id)

        const action = {
            ...this.createBaseAction(ActionType.Hurl),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination,
            gates: chosenGates,
            stationId: this.juggernautStationId
        }

        await this.doAction(action)
    }

    getGateChoices(
        start: OffsetCoordinates,
        end: OffsetCoordinates,
        chosenGates: SolarGate[]
    ): SolarGate[] {
        const illegalCoordinates: OffsetCoordinates[] = []
        if (this.juggernautStationId || this.gameState.activeEffect === EffectType.Hyperdrive) {
            // No 5 diver spots for juggernaut or hyperdrive
            illegalCoordinates.push(...this.gameState.board.getFiveDiverCoords(this.myPlayer!.id))
        }

        return this.gameState.board.gateChoicesForDestination({
            start,
            end,
            range: this.myPlayerState?.movementPoints ?? 0,
            requiredGates: chosenGates,
            portal: this.gameState.activeEffect === EffectType.Portal,
            illegalCoordinates
        })
    }

    async chooseMove() {
        if (!this.myPlayer || this.isMoving) {
            throw new Error('Invalid choose move')
        }

        const action = {
            ...this.createBaseAction(ActionType.ChooseMove),
            playerId: this.myPlayer.id
        }
        await this.doAction(action)
    }

    async chooseConvert() {
        if (!this.myPlayer || this.isConverting) {
            throw new Error('Invalid choose convert')
        }
        const action = {
            ...this.createBaseAction(ActionType.ChooseConvert),
            playerId: this.myPlayer.id
        }
        await this.doAction(action)
    }

    async chooseActivate() {
        if (!this.myPlayer || this.isActivating) {
            throw new Error('Invalid choose activate')
        }
        const action = {
            ...this.createBaseAction(ActionType.ChooseActivate),
            playerId: this.myPlayer.id
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

            const { divers, coords } = Array.from(sundiversByCoords.values()).at(-1) ?? {
                divers: [],
                coords: undefined
            }
            secondSundiver = divers.at(-1)
            this.chosenDiverCell = coords
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

        if (!this.isSolarFlares && this.gameState.activeEffect !== EffectType.Pulse) {
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
        if (!this.myPlayer) {
            throw new Error('Invalid pass')
        }
        const action = {
            ...this.createBaseAction(ActionType.Pass),
            playerId: this.myPlayer.id
        }

        await this.doAction(action)
    }

    async drawCards() {
        if (!this.myPlayer || !this.isDrawingCards) {
            throw new Error('Invalid draw card')
        }

        if (this.gameState.activeEffect === EffectType.Pillar && !this.pillarGuess) {
            throw new Error('Missing pillar guess')
        }

        const action = {
            ...this.createBaseAction(ActionType.DrawCards),
            suitGuess: this.pillarGuess,
            playerId: this.myPlayer.id,
            revealsInfo: true
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

    async activateEffect(effectType: EffectType) {
        if (!this.myPlayer) {
            throw new Error('Invalid activate effect')
        }

        const action = {
            ...this.createBaseAction(ActionType.ActivateEffect),
            playerId: this.myPlayer.id,
            effect: effectType
        }

        await this.doAction(action)
    }

    async invade() {
        if (!this.myPlayer || !this.chosenDestination) {
            throw new Error('Invalid invade')
        }

        const action = {
            ...this.createBaseAction(ActionType.Invade),
            playerId: this.myPlayer.id,
            coords: this.chosenDestination
        }

        await this.doAction(action)
    }

    async sacrifice() {
        if (!this.myPlayer || !this.chosenDestination) {
            throw new Error('Invalid invade')
        }

        const action = {
            ...this.createBaseAction(ActionType.Sacrifice),
            playerId: this.myPlayer.id,
            coords: this.chosenDestination
        }

        await this.doAction(action)
    }

    async hatch() {
        if (!this.myPlayer || !this.hatchLocation || !this.hatchTarget) {
            throw new Error('Invalid hatch')
        }

        const action = {
            ...this.createBaseAction(ActionType.Hatch),
            playerId: this.myPlayer.id,
            coords: this.hatchLocation,
            targetPlayerId: this.hatchTarget
        }

        await this.doAction(action)
    }

    async blight() {
        if (!this.myPlayer || !this.chosenSource) {
            throw new Error('Invalid blight')
        }

        // Need to figure out mothership
        let targetPlayerId: string | undefined = undefined
        const otherPlayers = this.gameState.players.filter((p) => p.playerId !== this.myPlayer!.id)
        for (const otherPlayer of otherPlayers) {
            const adjacentCoords = this.gameState.board.launchCoordinatesForMothership(
                otherPlayer.playerId
            )
            for (const coords of adjacentCoords) {
                if (sameCoordinates(coords, this.chosenSource)) {
                    targetPlayerId = otherPlayer.playerId
                    break
                }
            }
        }

        if (!targetPlayerId) {
            throw new Error('Could not find target player for blight')
        }

        const action = {
            ...this.createBaseAction(ActionType.Blight),
            playerId: this.myPlayer.id,
            targetPlayerId: targetPlayerId,
            coords: this.chosenSource
        }

        await this.doAction(action)
    }

    async accelerate() {
        if (!this.myPlayer || !this.accelerationAmount) {
            throw new Error('Invalid accelerate')
        }

        const action = {
            ...this.createBaseAction(ActionType.Accelerate),
            playerId: this.myPlayer.id,
            amount: this.accelerationAmount
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

    async setEffects() {
        const desiredEffects = [
            EffectType.Accelerate,
            EffectType.Blight,
            EffectType.Catapult,
            EffectType.Channel,
            EffectType.Duplicate,
            EffectType.Fuel
        ]

        let i = 0
        for (const key of Object.keys(this.gameState.effects)) {
            this.gameState.effects[key].type = desiredEffects[i]
            i++
        }

        await this.gameService.saveGameLocally({
            game: this.game,
            actions: this.actions,
            state: this.gameState.dehydrate()
        })
    }
}
