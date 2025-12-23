import { AnimationContext, GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    Card,
    Cell,
    CENTER_COORDS,
    SundiverChain,
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
    Sundiver,
    HydratedFly,
    Station
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
import { SvelteMap } from 'svelte/reactivity'

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    numPlayers = $derived.by(() => this.gameState.players.length)

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
    catapultChoice?: boolean = $state(undefined)
    metamorphosisType?: StationType = $state(undefined)
    chain?: SundiverChain = $state(undefined)
    chainStart?: 'beginning' | 'end' = $state(undefined)
    passageChoice?: boolean = $state(undefined)

    outlinedCells: OffsetCoordinates[] = $state([])

    shouldPickCluster: boolean = $derived(
        this.myPlayer !== undefined &&
            (this.chosenNumDivers ?? 0) > 1 &&
            this.chosenSource !== undefined &&
            this.gameState.activeEffect === EffectType.Cluster &&
            this.gameState.getEffectTracking().clustersRemaining > 0 &&
            this.clusterChoice === undefined
    )

    shouldPickTeleport: boolean = $derived(
        this.myPlayer !== undefined &&
            this.chosenSource !== undefined &&
            !this.chosenMothership &&
            this.chosenNumDivers === 1 &&
            this.gameState.activeEffect === EffectType.Teleport &&
            HydratedFly.canTeleport(this.gameState, this.myPlayer.id) &&
            this.teleportChoice === undefined
    )

    boardPickerLocation = $derived.by(() => {
        if (this.isAccelerating && !this.accelerationAmount) {
            return { x: 0, y: -515 }
        } else if (this.shouldPickCluster || this.shouldPickTeleport) {
            return getSpaceCentroid(this.numPlayers, this.chosenSource!)
        } else if (this.isMetamorphosizing && !this.metamorphosisType) {
            try {
                const station = this.gameState.getActivatingStation()
                return getSpaceCentroid(this.numPlayers, station.coords!)
            } catch {
                console.log("can't find activating station")
            }
        } else if (this.isChaining) {
            const chainEntry = this.chain?.find((entry) => !entry.sundiverId)
            if (chainEntry) {
                return getSpaceCentroid(this.numPlayers, chainEntry.coords)
            }
        } else if (this.chosenSource) {
            return getSpaceCentroid(this.numPlayers, this.chosenSource)
        } else if (this.chosenMothership) {
            const mothershipIndex = this.gameState.board.motherships[this.chosenMothership]
            return getMothershipSpotPoint(this.numPlayers, mothershipIndex)
        }

        return { x: 0, y: 0 }
    })

    mothershipLocations = $derived.by(() => {
        return new SvelteMap<string, number>(Object.entries(this.gameState.board.motherships))
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
    isTributing = $derived(this.gameState.machineState === MachineState.Tributing)
    isMetamorphosizing = $derived(this.gameState.machineState === MachineState.Metamorphosizing)
    isChaining = $derived(this.gameState.machineState === MachineState.Chaining)
    isEndOfGame = $derived(this.gameState.machineState === MachineState.EndOfGame)

    acting = $derived(this.gameState.machineState !== MachineState.StartOfTurn)

    forcedCallToAction = $state<string | undefined>(undefined)
    movingCubeIds: string[] = $state([])
    movingStation?: Station = $state(undefined)

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
            if (action.effect === EffectType.Catapult) {
                this.chosenNumDivers = undefined
            }
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
        // Always clear forced call to action
        this.forcedCallToAction = undefined
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

        if (this.chosenSource && this.gameState.getEffectTracking().clustersRemaining > 0) {
            return availableFromSource
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
        if (sameCoordinates(cell.coords, CENTER_COORDS)) {
            return { x: 0, y: 0 }
        }
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
        } else if (this.isMoving) {
            if (this.gateChoices) {
                this.gateChoices = undefined
            }

            if (this.teleportChoice !== undefined) {
                this.teleportChoice = undefined
            } else if (this.clusterChoice !== undefined) {
                this.clusterChoice = undefined
            } else if (this.chosenGates && this.chosenGates.length > 0) {
                this.chosenGates.pop()
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
            }
        }
    }

    resetAction() {
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
        this.catapultChoice = undefined
        this.metamorphosisType = undefined
        this.chain = undefined
        this.chainStart = undefined
        this.passageChoice = undefined

        this.outlinedCells = []

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

    async fly(hurl: boolean = false) {
        if (
            !this.myPlayer ||
            !this.myPlayerState ||
            !this.chosenSource ||
            (!this.chosenNumDivers && !this.juggernautStationId) ||
            !this.chosenDestination
        ) {
            throw new Error('Invalid flight')
        }

        const catapult =
            this.gameState.activeEffect === EffectType.Catapult && this.catapultChoice === true

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
            console.log('checking gates')
            do {
                const choiceData = this.getGateChoices(
                    this.chosenSource,
                    this.chosenDestination,
                    chosenGates,
                    catapult
                )
                console.log('choice data', choiceData)
                if (choiceData.gates.length > 1) {
                    this.gateChoices = choiceData.gates.map((gate) =>
                        this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                    )
                    console.log('gate choices', this.gateChoices)
                    return
                } else if (choiceData.gates.length === 1) {
                    if (choiceData.direct) {
                        break
                    }
                    if (!choiceData.direct) {
                        if (!this.chosenGates) {
                            this.chosenGates = []
                        }
                        const gate = choiceData.gates[0]
                        this.chosenGates.push(
                            this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                        )
                        chosenGates.push(gate)
                    }
                } else {
                    break
                }
            } while (true)
        }

        const playerDivers = this.gameState.board
            .sundiversForPlayer(this.myPlayer.id, cell)
            .toReversed()

        // Confusing... choosing to catapult means non catapulted divers but so does not the choice not being
        // made as in the normal case
        let chosenDivers = playerDivers

        if (this.passageChoice) {
            chosenDivers = chosenDivers.filter(
                (diver) => diver.id === this.gameState.getEffectTracking().passageSundiverId
            )
        } else if (this.gameState.activeEffect === EffectType.Catapult) {
            chosenDivers = chosenDivers.filter((diver) =>
                catapult
                    ? !this.gameState.getEffectTracking().catapultedIds.includes(diver.id)
                    : this.gameState.getEffectTracking().catapultedIds.includes(diver.id)
            )
        }
        chosenDivers = chosenDivers.slice(0, this.chosenNumDivers)
        const diverIds = this.juggernautStationId ? [] : chosenDivers.map((diver) => diver.id)

        if (diverIds.length === 0 && !this.juggernautStationId) {
            throw new Error('No sundivers to fly')
        }

        const passage =
            this.gameState.activeEffect === EffectType.Passage &&
            !this.gameState.getEffectTracking().passageSundiverId &&
            diverIds.length === 1

        const action = {
            ...this.createBaseAction(hurl ? ActionType.Hurl : ActionType.Fly),
            playerId: this.myPlayer.id,
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination,
            gates: chosenGates,
            cluster: this.clusterChoice ?? false,
            teleport: this.teleportChoice ?? false,
            stationId: this.juggernautStationId,
            catapult: this.catapultChoice ?? false,
            passage
        }
        console.log((hurl ? 'Hurling' : 'Flying') + ' with action', action)
        await this.doAction(action)
    }

    async hurl() {
        return this.fly(true)
    }

    getGateChoices(
        start: OffsetCoordinates,
        end: OffsetCoordinates,
        chosenGates: SolarGate[],
        catapult: boolean = false
    ): { gates: SolarGate[]; direct: boolean } {
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
            illegalCoordinates,
            catapult
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

    async fuel() {
        if (!this.myPlayer) {
            throw new Error('Invalid fuel')
        }

        const action = {
            ...this.createBaseAction(ActionType.Fuel),
            playerId: this.myPlayer.id
        }

        await this.doAction(action)
    }

    async tribute() {
        if (!this.myPlayer || !this.chosenSource) {
            throw new Error('Invalid tribute')
        }

        const action = {
            ...this.createBaseAction(ActionType.Tribute),
            playerId: this.myPlayer.id,
            coords: this.chosenSource
        }

        await this.doAction(action)
    }

    async metamorphosize() {
        if (!this.myPlayer || !this.metamorphosisType) {
            throw new Error('Invalid tribute')
        }

        const station = this.gameState.getActivatingStation()
        if (!station) {
            throw new Error('No station to metamorphosize')
        }

        const action = {
            ...this.createBaseAction(ActionType.Metamorphosize),
            playerId: this.myPlayer.id,
            stationId: station.id,
            stationType: this.metamorphosisType
        }

        await this.doAction(action)
    }

    async doChain() {
        if (!this.myPlayer || !this.chain || !this.chainStart) {
            throw new Error('Invalid chain')
        }

        const chainToSend = this.chainStart === 'beginning' ? this.chain : this.chain.toReversed()

        const action = {
            ...this.createBaseAction(ActionType.Chain),
            playerId: this.myPlayer.id,
            chain: chainToSend
        }

        await this.doAction(action)
    }

    async doAction(action: GameAction) {
        if (!this.isPlayable || this.animating) {
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
            EffectType.Portal,
            EffectType.Accelerate,
            EffectType.Metamorphosis,
            EffectType.Procreate,
            EffectType.Sacrifice,
            EffectType.Hatch
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
