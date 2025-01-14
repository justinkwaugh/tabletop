import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { SolarGate } from '../components/solarGate.js'

export type FlyMetadata = Static<typeof FlyMetadata>
export const FlyMetadata = Type.Object({})

export type Fly = Static<typeof Fly>
export const Fly = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Fly),
        playerId: Type.String(),
        sundiverIds: Type.Array(Type.String()),
        stationId: Type.Optional(Type.String()), // For juggernaut effect
        gates: Type.Optional(Type.Array(SolarGate)), // Ordered list of required gates to pass through
        start: OffsetCoordinates,
        destination: OffsetCoordinates,
        metadata: Type.Optional(FlyMetadata)
    })
])

export const FlyValidator = TypeCompiler.Compile(Fly)

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
    declare metadata?: FlyMetadata

    constructor(data: Fly) {
        super(data, FlyValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        const distanceMoved = this.isValidFlight(state)
        if (!distanceMoved) {
            throw Error('Invalid flight')
        }

        const removedSundivers = state.board.removeSundiversFromCell(this.sundiverIds, this.start)
        state.board.addSundiversToCell(removedSundivers, this.destination)
        playerState.movementPoints -= distanceMoved * this.sundiverIds.length
    }

    isValidFlight(state: HydratedSolGameState): number {
        const playerState = state.getPlayerState(this.playerId)
        if (
            !HydratedFly.isValidFlightDestination(
                state,
                this.playerId,
                this.sundiverIds.length,
                false,
                this.start,
                this.destination
            )
        ) {
            return 0
        }

        const path = state.board.pathToDestination({
            start: this.start,
            destination: this.destination,
            range: playerState.movementPoints / this.sundiverIds.length,
            requiredGates: this.gates
        })
        return path ? path.length - 1 : 0
    }

    static isValidFlightDestination(
        state: HydratedSolGameState,
        playerId: string,
        numSundivers: number,
        station: boolean,
        start: OffsetCoordinates,
        destination: OffsetCoordinates
    ): boolean {
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
        const range = Math.floor(playerState.movementPoints / numSundivers)
        const path = state.board.pathToDestination({ start, destination, range })
        if (!path) {
            return false
        }

        return true
    }
}
