import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'

export type ConvertMetadata = Static<typeof ConvertMetadata>
export const ConvertMetadata = Type.Object({})

export type Convert = Static<typeof Convert>
export const Convert = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Convert),
            playerId: Type.String(),
            sundiverIds: Type.Array(Type.String()),
            isGate: Type.Boolean(),
            stationType: Type.Optional(Type.Enum(StationType)),
            coords: OffsetCoordinates,
            neighborCoords: OffsetCoordinates, // For gate conversion
            metadata: Type.Optional(ConvertMetadata)
        })
    ])
)

export const ConvertValidator = Compile(Convert)

export function isConvert(action?: GameAction): action is Convert {
    return action?.type === ActionType.Convert
}

export class HydratedConvert extends HydratableAction<typeof Convert> implements Convert {
    declare type: ActionType.Convert
    declare playerId: string
    declare sundiverIds: string[]
    declare isGate: boolean
    declare stationType?: StationType
    declare coords: OffsetCoordinates
    declare neighborCoords: OffsetCoordinates // For gate conversion
    declare metadata?: ConvertMetadata

    constructor(data: Convert) {
        super(data, ConvertValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)

        // const distanceMoved = this.isValidFlight(state)
        // if (!distanceMoved) {
        //     throw Error('Invalid flight')
        // }

        // const removedSundivers = state.board.removeSundiversFromCell(this.sundiverIds, this.start)
        // state.board.addSundiversToCell(removedSundivers, this.destination)
        throw Error('Not implemented')
    }

    // isValidFlight(state: HydratedSolGameState): number {
    //     const playerState = state.getPlayerState(this.playerId)
    //     if (
    //         !HydratedFly.isValidFlightDestination(
    //             state,
    //             this.playerId,
    //             this.sundiverIds.length,
    //             false,
    //             this.start,
    //             this.destination
    //         )
    //     ) {
    //         return 0
    //     }

    //     const path = state.board.pathToDestination({
    //         start: this.start,
    //         destination: this.destination,
    //         range: playerState.movementPoints / this.sundiverIds.length,
    //         requiredGates: this.gates
    //     })
    //     return path ? path.length - 1 : 0
    // }

    static canConvert(state: HydratedSolGameState, playerId: string): boolean {
        return (
            this.canConvertEnergyNode(state, playerId) ||
            this.canConvertSundiverFoundry(state, playerId) ||
            this.canConvertTransmitTower(state, playerId) ||
            this.canConvertSolarGate(state, playerId)
        )
    }

    static canConvertSolarGate(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const hasSolarGates = playerState.solarGates.length > 0
        for (const cell of state.board) {
            if (hasSolarGates && state.board.canConvertGateAt(playerId, cell.coords)) {
                return true
            }
        }
        return false
    }

    static canConvertEnergyNode(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const hasEnergyNodes = playerState.energyNodes.length > 0
        for (const cell of state.board) {
            if (
                hasEnergyNodes &&
                state.board.canConvertStationAt(playerId, StationType.EnergyNode, cell.coords)
            ) {
                return true
            }
        }
        return false
    }

    static canConvertSundiverFoundry(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const hasSundiverFoundries = playerState.sundiverFoundries.length > 0
        for (const cell of state.board) {
            if (
                hasSundiverFoundries &&
                state.board.canConvertStationAt(playerId, StationType.SundiverFoundry, cell.coords)
            ) {
                return true
            }
        }
        return false
    }

    static canConvertTransmitTower(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        const hasTransmitTowers = playerState.transmitTowers.length > 0
        for (const cell of state.board) {
            if (
                hasTransmitTowers &&
                state.board.canConvertStationAt(playerId, StationType.TransmitTower, cell.coords)
            ) {
                return true
            }
        }
        return false
    }

    static isValidConversion(
        state: HydratedSolGameState,
        playerId: string,
        sundiverIds: string[],
        stationType: StationType,
        coords: OffsetCoordinates
    ): boolean {
        const playerState = state.getPlayerState(playerId)

        // Check to see if destination can hold the pieces

        return false
    }
}
