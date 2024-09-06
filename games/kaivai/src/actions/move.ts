import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiPlayerState } from '../model/playerState.js'
import { MachineState } from '../definition/states.js'

export type Move = Static<typeof Move>
export const Move = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Move),
        playerId: Type.String(),
        boatId: Type.String(),
        boatCoords: AxialCoordinates
    })
])

export const MoveValidator = TypeCompiler.Compile(Move)

export function isMove(action?: GameAction): action is Move {
    return action?.type === ActionType.Move
}

export class HydratedMove extends HydratableAction<typeof Move> implements Move {
    declare type: ActionType.Move
    declare playerId: string
    declare boatId: string
    declare boatCoords: AxialCoordinates

    constructor(data: Move) {
        super(data, MoveValidator)
    }

    apply(state: HydratedKaivaiGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedMove.isValidDestination({
            state,
            playerId: this.playerId,
            boatId: this.boatId,
            boatCoords: this.boatCoords
        })

        if (!valid) {
            throw Error(reason)
        }

        if (state.machineState === MachineState.TakingActions) {
            const requiredInfluence = state.influence[ActionType.Move] ?? 0
            if (playerState.influence < requiredInfluence) {
                throw Error('Player does not have enough influence to fish')
            }

            if (requiredInfluence === 0) {
                state.influence[ActionType.Move] = 1
            } else {
                playerState.influence -= requiredInfluence
                state.influence[ActionType.Move] += requiredInfluence
            }
        }

        // Sink opponents if needed
        const sunkBoat = state.board.removeBoatFrom(this.boatCoords)
        if (sunkBoat) {
            const sinkCost = HydratedMove.sinkCost(state, sunkBoat.owner)
            playerState.score -= sinkCost

            const ownerState = state.getPlayerState(sunkBoat.owner)
            ownerState.returnBoat(sunkBoat)
        }

        // Move boat
        const originalLocation = playerState.boatLocations[this.boatId]
        if (!originalLocation) {
            throw Error('Boat location not found')
        }

        const boat = state.board.removeBoatFrom(originalLocation)
        if (!boat) {
            throw Error('Boat not found at original location')
        }
        state.board.addBoatTo(this.boatCoords, boat)
        playerState.boatLocations[boat.id] = this.boatCoords

        // Mark boat as used
        playerState.availableBoats = playerState.availableBoats.filter((id) => id !== this.boatId)
    }

    static canBoatMove({
        gameState,
        playerState,
        boatId
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
    }): boolean {
        const validLocations = HydratedMove.validBoatLocations({
            gameState,
            playerState,
            boatId,
            stopAtFirst: true
        })

        return validLocations.length > 0
    }

    static validBoatLocations({
        gameState,
        playerState,
        boatId,
        stopAtFirst = false
    }: {
        gameState: HydratedKaivaiGameState
        playerState: HydratedKaivaiPlayerState
        boatId: string
        stopAtFirst?: boolean
    }): AxialCoordinates[] {
        const boatCoords = playerState.boatLocations[boatId]
        if (!boatCoords) {
            return []
        }

        const reachableHexes = gameState.board.getCoordinatesReachableByBoat(
            boatCoords,
            playerState
        )

        const validHexes: AxialCoordinates[] = []
        for (const hex of reachableHexes) {
            const { valid } = HydratedMove.isValidDestination({
                state: gameState,
                playerId: playerState.playerId,
                boatId,
                boatCoords: hex
            })
            if (valid) {
                validHexes.push(hex)
                if (stopAtFirst) {
                    return validHexes
                }
            }
        }
        return validHexes
    }

    static isValidDestination({
        state,
        playerId,
        boatCoords
    }: {
        state: HydratedKaivaiGameState
        playerId: string
        boatId: string
        boatCoords: AxialCoordinates
    }): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(playerId)
        const board = state.board

        if (!board.isWaterCell(boatCoords)) {
            return { valid: false, reason: 'Boat must be on water' }
        }

        const boat = state.board.getBoatAt(boatCoords)
        if (boat) {
            if (boat?.owner === playerId) {
                return { valid: false, reason: 'Cannot move onto your own boat' }
            }

            const sinkCost = HydratedMove.sinkCost(state, boat.owner)
            if (sinkCost === -1) {
                return { valid: false, reason: 'Cannot sink the last boat' }
            }

            if (playerState.score < sinkCost) {
                return { valid: false, reason: 'Cannot afford to sink the boat' }
            }
        }

        return { valid: true, reason: '' }
    }

    static sinkCost(state: HydratedKaivaiGameState, opponentId: string) {
        const playerState = state.getPlayerState(opponentId)
        const numBoatsOnBoard = Object.keys(playerState.boatLocations).length
        if (numBoatsOnBoard === 1) {
            return -1
        }

        return 6 - numBoatsOnBoard
    }
}
