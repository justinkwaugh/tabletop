import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Direction } from '../utils/solGraph.js'

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
            innerCoords: OffsetCoordinates, // For gate conversion
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
    declare innerCoords: OffsetCoordinates // For gate conversion
    declare metadata?: ConvertMetadata

    constructor(data: Convert) {
        super(data, ConvertValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (!HydratedConvert.isValidConversion(state, this)) {
            throw Error('Invalid conversion')
        }

        const playerState = state.getPlayerState(this.playerId)

        if (this.isGate) {
            const playerGate = playerState.removeSolarGate()
            state.board.addGateAt(playerGate, this.innerCoords, this.coords)
        }

        const removedSundivers = state.board.removeSundiversFromBoard(this.sundiverIds)
        playerState.addSundiversToReserve(removedSundivers)
    }

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

    static isValidConversion(state: HydratedSolGameState, convert: Convert): boolean {
        const playerState = state.getPlayerState(convert.playerId)

        if (convert.isGate) {
            if (convert.sundiverIds.length !== 2) {
                return false
            }

            if (playerState.solarGates.length === 0) {
                return false
            }

            if (state.board.hasGateBetween(convert.coords, convert.innerCoords)) {
                return false
            }

            if (!state.board.canConvertGateAt(convert.playerId, convert.coords)) {
                return false
            }

            const firstSundivers = state.board.sundiversForPlayerAt(
                convert.playerId,
                convert.coords
            )
            const firstIndex = convert.sundiverIds.findIndex((sundiverId) => {
                return firstSundivers.find((sundiver) => sundiver.id === sundiverId)
            })
            if (firstIndex === -1) {
                return false
            }

            const secondDiverId = convert.sundiverIds[firstIndex === 0 ? 1 : 0]
            const secondSundivers = []
            for (const cell of state.board.neighborsAt(convert.coords, Direction.Out)) {
                secondSundivers.push(
                    ...state.board.sundiversForPlayerAt(convert.playerId, cell.coords)
                )
            }
            if (!secondSundivers.find((sundiver) => sundiver.id === secondDiverId)) {
                return false
            }

            return true
        }

        // Check to see if destination can hold the pieces

        return false
    }
}
