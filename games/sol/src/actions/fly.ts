import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'
import { EffectType } from '../components/effects.js'
import { Direction, Ring } from '../utils/solGraph.js'
import { CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'

export type FlyMetadata = Static<typeof FlyMetadata>
export const FlyMetadata = Type.Object({
    flightPath: Type.Array(OffsetCoordinates),
    puncturedGate: Type.Optional(SolarGate)
})

export type Fly = Static<typeof Fly>
export const Fly = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Fly),
            playerId: Type.String(),
            sundiverIds: Type.Array(Type.String()),
            stationId: Type.Optional(Type.String()), // For juggernaut effect
            gates: Type.Array(SolarGate), // Ordered list of required gates to pass through
            start: OffsetCoordinates,
            destination: OffsetCoordinates,
            cluster: Type.Boolean(),
            metadata: Type.Optional(FlyMetadata)
        })
    ])
)

export const FlyValidator = Compile(Fly)

export function isFly(action?: GameAction): action is Fly {
    return action?.type === ActionType.Fly
}

export class HydratedFly extends HydratableAction<typeof Fly> implements Fly {
    declare type: ActionType.Fly
    declare playerId: string
    declare sundiverIds: string[]
    declare stationId?: string
    declare gates: SolarGate[]
    declare start: OffsetCoordinates
    declare destination: OffsetCoordinates
    declare cluster: boolean
    declare metadata?: FlyMetadata

    constructor(data: Fly) {
        super(data, FlyValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const path = this.isValidFlight(state)
        if (!path) {
            throw Error('Invalid flight')
        }

        state.moved = true
        this.metadata = {
            flightPath: path
        }

        const distanceMoved = path.length - 1
        const removedSundivers = state.board.removeSundiversAt(this.sundiverIds, this.start)

        if (this.cluster) {
            playerState.movementPoints -= distanceMoved
            state.getEffectTracking().clustersRemaining -= 1
        } else {
            playerState.movementPoints -= distanceMoved * this.sundiverIds.length
        }

        if (state.activeEffect === EffectType.Puncture) {
            playerState.addSundiversToReserve(removedSundivers)
            const playerGate = playerState.removeSolarGate()
            this.metadata.puncturedGate = playerGate

            if (this.start.row < this.destination.row) {
                state.board.addGateAt(playerGate, this.start, this.destination)
            } else {
                state.board.addGateAt(playerGate, this.destination, this.start)
            }
            state.activeEffect = undefined
            state.cardsToDraw +=
                CARDS_DRAWN_PER_RING[Math.min(this.start.row, this.destination.row)]
        } else {
            state.board.addSundiversToCell(removedSundivers, this.destination)
        }
        if (state.activeEffect === EffectType.Hyperdrive) {
            state.getEffectTracking().flownSundiverId = this.sundiverIds[0]
            state.getEffectTracking().movementUsed += distanceMoved
        }

        for (const gate of this.gates) {
            if (gate.playerId !== this.playerId && !state.paidPlayerIds.includes(gate.playerId)) {
                const gateOwner = state.getPlayerState(gate.playerId)
                gateOwner.energyCubes += 1
                state.paidPlayerIds.push(gate.playerId)
            }
        }
    }

    static canFly(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (playerState.movementPoints <= 0) {
            return false
        }

        for (const cell of state.board) {
            const sundiversInCell = state.board.sundiversForPlayerAt(playerId, cell.coords)
            if (sundiversInCell.length > 0) {
                return true
            }
        }
        return false
    }

    isValidFlight(state: HydratedSolGameState): OffsetCoordinates[] | undefined {
        const playerState = state.getPlayerState(this.playerId)

        if (
            this.cluster &&
            (state.activeEffect !== EffectType.Cluster || !state.effectTracking?.clustersRemaining)
        ) {
            console.log('no more clusters remaining')
            return
        }

        if (
            state.activeEffect === EffectType.Hyperdrive &&
            (this.sundiverIds.length !== 1 ||
                (state.effectTracking?.flownSundiverId &&
                    state.effectTracking?.flownSundiverId !== this.sundiverIds[0]))
        ) {
            console.log('invalid hyperdrive flight')
            return
        }

        if (
            !HydratedFly.isValidFlightDestination({
                state,
                playerId: this.playerId,
                numSundivers: this.sundiverIds.length,
                start: this.start,
                destination: this.destination,
                cluster: this.cluster
            })
        ) {
            console.log('invalid flight destination')
            return
        }

        if (state.activeEffect === EffectType.Puncture) {
            return [this.start, this.destination]
        }
        return state.board.pathToDestination({
            start: this.start,
            destination: this.destination,
            range: playerState.movementPoints / this.sundiverIds.length,
            requiredGates: this.gates,
            portal: state.activeEffect === EffectType.Portal
        })
    }

    static isValidFlightDestination({
        state,
        playerId,
        numSundivers,
        station = false,
        start,
        destination,
        cluster = false
    }: {
        state: HydratedSolGameState
        playerId: string
        numSundivers: number
        station?: boolean
        start: OffsetCoordinates
        destination: OffsetCoordinates
        cluster?: boolean
    }): boolean {
        const playerState = state.getPlayerState(playerId)

        if (state.activeEffect === EffectType.Puncture) {
            return this.isValidPuncture({ state, playerId, numSundivers, start, destination })
        }

        // Check to see if destination can hold the pieces
        if (
            numSundivers > 0 &&
            !state.board.canAddSundiversToCell(playerId, numSundivers, destination)
        ) {
            console.log('Cannot add sundivers to cell')
            return false
        }

        if (station && !state.board.canAddStationToCell(destination)) {
            return false
        }

        // Check range
        let range = playerState.movementPoints
        if (cluster) {
            range = 1
        } else {
            range = Math.floor(range / numSundivers)
        }
        const portal = state.activeEffect === EffectType.Portal
        const path = state.board.pathToDestination({ start, destination, range, portal })
        if (!path) {
            console.log('No path found')
            return false
        }

        return true
    }

    static isValidPuncture({
        state,
        playerId,
        numSundivers,
        start,
        destination
    }: {
        state: HydratedSolGameState
        playerId: string
        numSundivers: number
        start: OffsetCoordinates
        destination: OffsetCoordinates
    }) {
        const playerState = state.getPlayerState(playerId)
        // Adjacent across barrier without gate, 1 movement point
        if (
            playerState.movementPoints < 1 ||
            playerState.solarGates.length === 0 ||
            numSundivers > 1
        ) {
            return false
        }
        const startCell = state.board.cellAt(start)
        const destinationCell = state.board.cellAt(destination)
        if (startCell.coords.row === Ring.Outer || destinationCell.coords.row === Ring.Outer) {
            return false
        }
        if (Math.abs(startCell.coords.row - destinationCell.coords.row) !== 1) {
            return false
        }
        if (!state.board.areNeighbors(start, destination)) {
            return false
        }
        if (state.board.hasGateBetween(start, destination)) {
            return false
        }
        return true
    }

    static canPunctureFrom(
        coords: OffsetCoordinates,
        state: HydratedSolGameState,
        playerId: string
    ): boolean {
        if (coords.row === Ring.Outer) {
            return false
        }
        const sundivers = state.board.sundiversForPlayerAt(playerId, coords)
        if (sundivers.length === 0) {
            return false
        }
        const neighbors = [
            ...state.board.neighborsAt(coords, Direction.In),
            ...state.board.neighborsAt(coords, Direction.Out)
        ]
        for (const neighbor of neighbors) {
            if (!state.board.hasGateBetween(coords, neighbor.coords)) {
                return true
            }
        }

        return false
    }
}
