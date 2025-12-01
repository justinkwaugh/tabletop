import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StationType } from '../components/stations.js'
import { Direction, Ring } from '../utils/solGraph.js'
import { CARDS_DRAWN_PER_RING } from '../utils/solConstants.js'

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
            innerCoords: Type.Optional(OffsetCoordinates), // For gate conversion
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
        } else if (this.stationType === StationType.EnergyNode) {
            const playerNode = playerState.removeEnergyNode()
            state.board.addStationAt(playerNode, this.coords)
        } else if (this.stationType === StationType.SundiverFoundry) {
            const playerFoundry = playerState.removeSundiverFoundry()
            state.board.addStationAt(playerFoundry, this.coords)
        } else if (this.stationType === StationType.TransmitTower) {
            const playerTower = playerState.removeTransmitTower()
            state.board.addStationAt(playerTower, this.coords)
        }

        const removedSundivers = state.board.removeSundiversFromBoard(this.sundiverIds)
        playerState.addSundiversToReserve(removedSundivers)

        const playerMovement = Iterator.from(Object.values(Ring)).reduce(
            (acc, ring) =>
                state.board.hasStationInRing(this.playerId, ring as Ring) ? acc + 1 : acc,
            3
        )

        playerState.movement = playerMovement

        const ring = this.isGate ? this.innerCoords.row : this.coords.row
        state.cardsToDraw = CARDS_DRAWN_PER_RING[ring]
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
            return HydratedConvert.isValidGateConversion(state, convert)
        } else if (convert.stationType === StationType.EnergyNode) {
            return HydratedConvert.isValidEnergyNodeConversion(state, convert)
        } else if (convert.stationType === StationType.SundiverFoundry) {
            return HydratedConvert.isValidSundiverFoundryConversion(state, convert)
        }

        return false
    }

    static isValidGateConversion(state: HydratedSolGameState, convert: Convert): boolean {
        const playerState = state.getPlayerState(convert.playerId)

        if (convert.sundiverIds.length !== 2) {
            return false
        }

        if (playerState.solarGates.length === 0) {
            return false
        }

        if (!convert.innerCoords) {
            return false
        }

        if (state.board.hasGateBetween(convert.coords, convert.innerCoords)) {
            return false
        }

        if (!state.board.canConvertGateAt(convert.playerId, convert.coords)) {
            return false
        }

        const firstSundivers = state.board.sundiversForPlayerAt(convert.playerId, convert.coords)
        const firstIndex = convert.sundiverIds.findIndex((sundiverId) => {
            return firstSundivers.find((sundiver) => sundiver.id === sundiverId)
        })
        if (firstIndex === -1) {
            return false
        }

        const secondDiverId = convert.sundiverIds[firstIndex === 0 ? 1 : 0]
        const secondSundivers = []
        for (const cell of state.board.neighborsAt(convert.coords, Direction.Out)) {
            secondSundivers.push(...state.board.sundiversForPlayerAt(convert.playerId, cell.coords))
        }
        if (!secondSundivers.find((sundiver) => sundiver.id === secondDiverId)) {
            return false
        }

        return true
    }

    static isValidEnergyNodeConversion(state: HydratedSolGameState, convert: Convert): boolean {
        const playerState = state.getPlayerState(convert.playerId)
        if (convert.sundiverIds.length !== 2) {
            return false
        }

        if (playerState.energyNodes.length === 0) {
            return false
        }

        if (
            !state.board.canConvertStationAt(
                convert.playerId,
                StationType.EnergyNode,
                convert.coords
            )
        ) {
            return false
        }

        const ccwNeighbor = state.board
            .neighborsAt(convert.coords, Direction.CounterClockwise)
            .at(-1)
        const cwNeighbor = state.board.neighborsAt(convert.coords, Direction.Clockwise).at(-1)

        if (!ccwNeighbor || !cwNeighbor) {
            return false
        }

        const ccwSundivers = state.board.sundiversForPlayer(convert.playerId, ccwNeighbor)
        const firstIndex = convert.sundiverIds.findIndex((sundiverId) => {
            return ccwSundivers.find((sundiver) => sundiver.id === sundiverId)
        })

        if (firstIndex === -1) {
            return false
        }

        const secondDiverId = convert.sundiverIds[firstIndex === 0 ? 1 : 0]
        const cwSundivers = state.board.sundiversForPlayer(convert.playerId, cwNeighbor)
        if (!cwSundivers.find((sundiver) => sundiver.id === secondDiverId)) {
            return false
        }

        return true
    }

    static isValidSundiverFoundryConversion(
        state: HydratedSolGameState,
        convert: Convert
    ): boolean {
        const playerState = state.getPlayerState(convert.playerId)
        if (convert.sundiverIds.length !== 2) {
            return false
        }

        if (playerState.sundiverFoundries.length === 0) {
            return false
        }

        if (
            !state.board.canConvertStationAt(
                convert.playerId,
                StationType.SundiverFoundry,
                convert.coords
            )
        ) {
            return false
        }

        const localSundivers = state.board.sundiversForPlayerAt(convert.playerId, convert.coords)
        const firstIndex = convert.sundiverIds.findIndex((sundiverId) => {
            return localSundivers.find((sundiver) => sundiver.id === sundiverId)
        })

        if (firstIndex === -1) {
            return false
        }

        const secondDiverId = convert.sundiverIds[firstIndex === 0 ? 1 : 0]

        const neighbors = [
            ...state.board.neighborsAt(convert.coords, Direction.Clockwise),
            ...state.board.neighborsAt(convert.coords, Direction.CounterClockwise)
        ]

        for (const neighbor of neighbors) {
            if (neighbor.sundivers.find((diver) => diver.id === secondDiverId)) {
                return true
            }
        }

        return false
    }
}
