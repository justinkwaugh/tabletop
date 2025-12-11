import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'
import { EffectType } from '../components/effects.js'

export type FlyMetadata = Static<typeof FlyMetadata>
export const FlyMetadata = Type.Object({
    flightPath: Type.Array(OffsetCoordinates)
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

        this.metadata = {
            flightPath: path
        }

        const distanceMoved = path.length - 1
        const removedSundivers = state.board.removeSundiversAt(this.sundiverIds, this.start)
        state.board.addSundiversToCell(removedSundivers, this.destination)
        if (this.cluster) {
            playerState.movementPoints -= distanceMoved
            state.getEffectTracking().clustersRemaining -= 1
        } else {
            playerState.movementPoints -= distanceMoved * this.sundiverIds.length
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
            return
        }

        return state.board.pathToDestination({
            start: this.start,
            destination: this.destination,
            range: playerState.movementPoints / this.sundiverIds.length,
            requiredGates: this.gates
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

        // Check to see if destination can hold the pieces
        if (
            numSundivers > 0 &&
            !state.board.canAddSundiversToCell(playerId, numSundivers, destination)
        ) {
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
        const path = state.board.pathToDestination({ start, destination, range })
        if (!path) {
            return false
        }

        return true
    }
}
