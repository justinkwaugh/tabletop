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
    Station,
    isChooseActivate,
    isChooseConvert,
    isChooseMove,
    HydratedSolPlayerState,
    isFly,
    isHurl,
    PassContext,
    isPass,
    Tribute,
    DrawCards,
    ChooseCard,
    ActivateEffect,
    Launch,
    Hurl,
    Fly,
    ChooseMove,
    ChooseConvert,
    ChooseActivate,
    Convert,
    Activate,
    ActivateBonus,
    Pass,
    Invade,
    Sacrifice,
    Hatch,
    Blight,
    Accelerate,
    Fuel,
    Metamorphosize,
    Chain,
    Deconstruct
} from '@tabletop/sol'
import {
    assert,
    assertExists,
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

export type PlayerStateOverride = {
    holdSundiversByPlayer?: Map<string, number>
    energyCubes?: number
    reserveSundivers?: number
    solarGates?: number
    energyNodes?: number
    sundiverFoundries?: number
    transmitTowers?: number
}

export class SolGameSession extends GameSession<SolGameState, HydratedSolGameState> {
    myPlayerState = $derived.by(() =>
        this.gameState.players.find((p) => p.playerId === this.myPlayer?.id)
    )

    turnPlayer: HydratedSolPlayerState | undefined = $derived.by(() => {
        const playerId = this.gameState.turnManager.currentTurn()?.playerId
        if (!playerId) {
            return undefined
        }
        return this.gameState.players.find((player) => player.playerId === playerId)
    })

    justAfterMyTurn = $derived.by(() => {
        if (this.gameState.turnManager.lastPlayer() !== this.myPlayer?.id) {
            return false
        }
        return this.gameState.turnManager.currentTurn()?.start == this.gameState.actionCount
    })

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
            this.chosenSource !== undefined &&
            this.gameState.activeEffect === EffectType.Cluster &&
            this.gameState.getEffectTracking().clustersRemaining > 0 &&
            this.chosenNumDivers === undefined &&
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
        if (!this.myPlayer) {
            return { x: 0, y: 0 }
        }

        if (this.isAccelerating && !this.accelerationAmount) {
            return { x: 0, y: -515 }
        } else if (this.shouldPickCluster || this.shouldPickTeleport) {
            return getSpaceCentroid(this.numPlayers, this.chosenSource!)
        } else if (this.isMetamorphosizing && !this.metamorphosisType) {
            try {
                const station = this.gameState.getActivatingStation(this.myPlayer.id)
                return getSpaceCentroid(this.numPlayers, station.coords!)
            } catch {
                // console.log("can't find activating station")
            }
        } else if (this.isHatching && this.hatchLocation && !this.hatchTarget) {
            return getSpaceCentroid(this.numPlayers, this.hatchLocation)
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
    canDeconstruct = $derived(this.validActionTypes.includes(ActionType.Deconstruct))

    acting = $derived(
        this.gameState.machineState !== MachineState.StartOfTurn || this.canDeconstruct
    )

    forcedCallToAction = $state<string | undefined>(undefined)
    movingCubeIds: string[] = $state([])
    movingMomentumIds: string[] = $state([])
    movingStation?: Station = $state(undefined)
    movingSundivers: Sundiver[] = $state([])

    playerStateOverrides: SvelteMap<string, PlayerStateOverride> = $state(
        new SvelteMap<string, PlayerStateOverride>()
    )

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
        this.playerStateOverrides.clear()
    }

    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        if (isChooseActivate(action) || isChooseConvert(action) || isChooseMove(action)) {
            return true
        }

        if (isActivateEffect(action) && action.effect !== EffectType.Procreate) {
            return true
        }

        if (
            action.playerId === next?.playerId &&
            (isFly(action) ||
                isLaunch(action) ||
                isHurl(action) ||
                (isPass(action) && action.context === PassContext.DoneMoving) ||
                (isActivateEffect(action) && action.effect !== EffectType.Procreate)) &&
            (isFly(next) ||
                isLaunch(next) ||
                isHurl(next) ||
                (isPass(next) && next.context === PassContext.DoneMoving) ||
                (isActivateEffect(next) && next.effect !== EffectType.Procreate))
        ) {
            return true
        }

        return false
    }

    async launch() {
        const action = this.createPlayerAction(Launch, {
            mothership: this.chosenMothership,
            numSundivers: this.chosenNumDivers,
            destination: this.chosenDestination
        })

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
            assertExists(gate, 'Invalid gate for flight')
            return gate
        })

        if (
            this.gameState.activeEffect !== EffectType.Transcend &&
            !this.teleportChoice &&
            this.gameState.board.requiresGateBetween(this.chosenSource, this.chosenDestination)
        ) {
            // console.log('checking gates')
            do {
                const choiceData = this.getGateChoices(
                    this.chosenSource,
                    this.chosenDestination,
                    chosenGates,
                    catapult
                )
                // always prefer direct paths
                if (choiceData.direct) {
                    break
                }

                if (choiceData.gates.length > 1) {
                    this.gateChoices = choiceData.gates.map((gate) =>
                        this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                    )
                    // console.log('gate choices', this.gateChoices)
                    return
                } else if (choiceData.gates.length === 1) {
                    if (!this.chosenGates) {
                        this.chosenGates = []
                    }
                    const gate = choiceData.gates[0]
                    this.chosenGates.push(
                        this.gameState.board.gateKey(gate.outerCoords!, gate.innerCoords!)
                    )
                    chosenGates.push(gate)
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

        const action = this.createPlayerAction(hurl ? Hurl : Fly, {
            sundiverIds: diverIds,
            start: this.chosenSource,
            destination: this.chosenDestination,
            gates: chosenGates,
            cluster: this.clusterChoice ?? false,
            teleport: this.teleportChoice ?? false,
            stationId: this.juggernautStationId,
            catapult: this.catapultChoice ?? false,
            passage
        })

        // console.log((hurl ? 'Hurling' : 'Flying') + ' with action', action)
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
        assert(!this.isMoving, 'Invalid choose move')

        const action = this.createPlayerAction(ChooseMove)
        await this.doAction(action)
    }

    async chooseConvert() {
        assert(!this.isConverting, 'Invalid choose convert')

        const action = this.createPlayerAction(ChooseConvert)
        await this.doAction(action)
    }

    async chooseActivate() {
        assert(!this.isActivating, 'Invalid choose activate')

        const action = this.createPlayerAction(ChooseActivate)
        await this.doAction(action)
    }

    async convertGate() {
        assert(
            this.myPlayer &&
                this.myPlayerState &&
                this.chosenConvertType === ConvertType.SolarGate &&
                this.chosenSource &&
                this.chosenDestination,
            'Invalid gate conversion'
        )

        const sundiverIds = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        assertExists(firstSundiver, 'No sundiver at source cell')

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

        assertExists(secondSundiver, 'No sundiver at destination cell')

        sundiverIds.push(secondSundiver.id)

        const action = this.createPlayerAction(Convert, {
            isGate: true,
            sundiverIds,
            coords: this.chosenSource,
            innerCoords: this.chosenDestination
        })

        await this.doAction(action)
    }

    async convertEnergyNode() {
        assert(
            this.myPlayer && this.myPlayerState && this.chosenConvertType && this.chosenSource,
            'Invalid energy node conversion'
        )

        const ccwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.CounterClockwise)
            .at(-1)
        assert(ccwNeighbor, 'No CCW neighbor')

        const cwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.Clockwise)
            .at(-1)
        assert(cwNeighbor, 'No CW neighbor')

        const firstSundiver = this.gameState.board
            .sundiversForPlayer(this.myPlayer.id, ccwNeighbor)
            .at(-1)
        assert(firstSundiver, 'No first sundiver to convert energy node')

        const secondSundiver = this.gameState.board
            .sundiversForPlayer(this.myPlayer.id, cwNeighbor)
            .at(-1)
        assert(secondSundiver, 'No second sundiver to convert energy node')

        const sundiverIds = [firstSundiver.id, secondSundiver.id]

        const action = this.createPlayerAction(Convert, {
            isGate: false,
            stationType: StationType.EnergyNode,
            sundiverIds,
            coords: this.chosenSource
        })

        await this.doAction(action)
    }

    async convertSundiverFoundry() {
        assert(
            this.myPlayer && this.myPlayerState && this.chosenConvertType && this.chosenSource,
            'Invalid foundry conversion'
        )

        const ccwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.CounterClockwise)
            .at(-1)
        assert(ccwNeighbor, 'No CCW neighbor')

        const cwNeighbor = this.gameState.board
            .neighborsAt(this.chosenSource, Direction.Clockwise)
            .at(-1)
        assert(cwNeighbor, 'No CW neighbor')

        const sundiverIds: string[] = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        assertExists(firstSundiver, 'No sundiver at local cell')

        sundiverIds.push(firstSundiver.id)

        if (this.chosenDiverCell) {
            const secondSundiver = this.gameState.board
                .sundiversForPlayerAt(this.myPlayer.id, this.chosenDiverCell)
                .at(-1)
            assertExists(secondSundiver, 'No second sundiver found')
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

            const nextDiver = secondSundiver ?? alternateSecondSundiver
            assertExists(nextDiver, 'No second sundiver found')

            sundiverIds.push(nextDiver.id)
        }

        assert(sundiverIds.length === 2, 'not enough sundivers to convert')

        const action = this.createPlayerAction(Convert, {
            isGate: false,
            stationType: StationType.SundiverFoundry,
            sundiverIds,
            coords: this.chosenSource
        })
        await this.doAction(action)
    }

    async convertTransmitTower() {
        assert(
            this.myPlayer && this.myPlayerState && this.chosenConvertType && this.chosenSource,
            'Invalid tower conversion'
        )

        const sundiverIds = []
        const firstSundiver = this.gameState.board
            .sundiversForPlayerAt(this.myPlayer.id, this.chosenSource)
            .at(-1)

        assertExists(firstSundiver, 'No first sundiver to convert gate')

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

        assertExists(secondSundiver, 'No second sundiver to convert gate')
        sundiverIds.push(secondSundiver.id)

        let thirdSundiver
        if (!this.chosenSecondDiverCell) {
            assertExists(this.chosenDiverCell, 'No chosen diver cell for second sundiver')

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

        assertExists(thirdSundiver, 'No third sundiver to convert gate')
        sundiverIds.push(thirdSundiver.id)

        const action = this.createPlayerAction(Convert, {
            isGate: false,
            stationType: StationType.TransmitTower,
            sundiverIds,
            coords: this.chosenSource,
            innerCoords: this.chosenDestination
        })

        await this.doAction(action)
    }

    async activateStation() {
        assert(this.myPlayer && this.chosenSource, 'Invalid activate station')

        const cell = this.gameState.board.cellAt(this.chosenSource)
        const station = cell.station
        assertExists(station, 'No station at chosen source')

        if (!this.isSolarFlares && this.gameState.activeEffect !== EffectType.Pulse) {
            const playerDivers = this.gameState.board.sundiversForPlayer(this.myPlayer.id, cell)
            assert(playerDivers.length >= 1, 'Not enough divers to activate station')
        }

        const action = this.createPlayerAction(Activate, {
            stationId: station.id,
            coords: cell.coords
        })

        if (this.isSolarFlares) {
            action.simultaneousGroupId = this.gameState.solarFlareActivationsGroupId
        }

        await this.doAction(action)
    }

    async activateBonus() {
        assert(this.isActivating, 'Invalid activate bonus')
        const action = this.createPlayerAction(ActivateBonus)
        await this.doAction(action)
    }

    async pass(context?: PassContext) {
        const action = this.createPlayerAction(Pass, {
            context
        })

        if (this.isSolarFlares) {
            action.simultaneousGroupId = this.gameState.solarFlareActivationsGroupId
        }

        await this.doAction(action)
    }

    async drawCards() {
        assert(this.isDrawingCards, 'Invalid draw card')

        if (this.gameState.activeEffect === EffectType.Pillar && !this.pillarGuess) {
            throw new Error('Missing pillar guess')
        }

        const action = this.createPlayerAction(DrawCards, {
            suitGuess: this.pillarGuess
        })

        await this.doAction(action)
    }

    async chooseCard(suit: Suit) {
        assert(this.isChoosingCard, 'Invalid choose card')

        const action = this.createPlayerAction(ChooseCard, {
            suit
        })

        await this.doAction(action)
    }

    async activateEffect(effectType: EffectType) {
        const action = this.createPlayerAction(ActivateEffect, {
            effect: effectType
        })

        await this.doAction(action)
    }

    async invade() {
        const action = this.createPlayerAction(Invade, {
            coords: this.chosenDestination
        })

        await this.doAction(action)
    }

    async sacrifice() {
        const action = this.createPlayerAction(Sacrifice, {
            coords: this.chosenDestination
        })
        await this.doAction(action)
    }

    async hatch() {
        const action = this.createPlayerAction(Hatch, {
            coords: this.hatchLocation,
            targetPlayerId: this.hatchTarget
        })

        await this.doAction(action)
    }

    async blight() {
        assert(this.chosenSource, 'Invalid blight')

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

        assertExists(targetPlayerId, 'Could not find target player for blight')

        const action = this.createPlayerAction(Blight, {
            targetPlayerId: targetPlayerId,
            coords: this.chosenSource
        })

        await this.doAction(action)
    }

    async accelerate() {
        const action = this.createPlayerAction(Accelerate, {
            amount: this.accelerationAmount
        })
        await this.doAction(action)
    }

    async fuel() {
        const action = this.createPlayerAction(Fuel)
        await this.doAction(action)
    }

    async tribute() {
        const action = this.createPlayerAction(Tribute, {
            coords: this.chosenSource
        })
        await this.doAction(action)
    }

    async metamorphosize() {
        assertExists(this.myPlayer, 'Invalid metamorphosize')

        const station = this.gameState.getActivatingStation(this.myPlayer.id)
        assertExists(station, 'No station to metamorphosize')

        const action = this.createPlayerAction(Metamorphosize, {
            stationId: station.id,
            stationType: this.metamorphosisType
        })

        await this.doAction(action)
    }

    async doChain() {
        assert(this.chain && this.chainStart, 'Invalid chain')
        const chainToSend = this.chainStart === 'beginning' ? this.chain : this.chain.toReversed()

        const action = this.createPlayerAction(Chain, {
            chain: chainToSend
        })
        await this.doAction(action)
    }

    async deconstruct() {
        const action = this.createPlayerAction(Deconstruct, {
            coords: this.chosenSource
        })
        await this.doAction(action)
    }

    async doAction(action: GameAction) {
        try {
            await this.applyAction(action)
        } catch (e) {
            console.error('Error for action', e, action)
        }
    }

    async updateEffectForSuit(suit: Suit, effectType: EffectType) {
        this.gameState.effects[suit].type = effectType
        await this.setGameState(this.gameState.dehydrate())
    }
}
