import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Placement } from '../components/gameBoard.js'

export type PlaceMaster = Static<typeof PlaceMaster>
export const PlaceMaster = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.PlaceMaster),
        playerId: Type.String(),
        placement: Placement
    })
])

export const PlaceMasterValidator = TypeCompiler.Compile(PlaceMaster)

export function isPlaceMaster(action?: GameAction): action is PlaceMaster {
    return action?.type === ActionType.PlaceMaster
}

export class HydratedPlaceMaster
    extends HydratableAction<typeof PlaceMaster>
    implements PlaceMaster
{
    declare type: ActionType.PlaceMaster
    declare playerId: string
    declare placement: Placement

    constructor(data: PlaceMaster) {
        super(data, PlaceMasterValidator)
    }

    apply(state: HydratedBridgesGameState) {
        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasPiece(this.placement.masterType)) {
            throw Error(`Player ${this.playerId} has no master to place`)
        }

        const { valid, reason } = HydratedPlaceMaster.isValidPlacement(
            state,
            this.playerId,
            this.placement
        )

        if (!valid) {
            throw Error(reason)
        }

        const village = state.board.villages[this.placement.village]
        village.addMaster(this.placement.masterType, this.playerId)
        playerState.removePiece(this.placement.masterType)
        state.score()
    }

    static isValidPlacement(
        state: HydratedBridgesGameState,
        playerId: string,
        placement: Placement
    ): { valid: boolean; reason: string } {
        const board = state.board
        if (!board.hasVillage(placement.village)) {
            return { valid: false, reason: `Invalid Village ${placement.village}` }
        }

        const selectedVillage = board.villages[placement.village]
        if (selectedVillage.isAtPeace()) {
            return { valid: false, reason: `Village ${selectedVillage} is at peace` }
        }

        if (selectedVillage.hasMaster(placement.masterType)) {
            return {
                valid: false,
                reason: `Village ${selectedVillage} already has a ${placement.masterType}`
            }
        }

        if (
            state.turnManager.turnCount(playerId) < 7 &&
            selectedVillage.numberOfMastersForPlayer(playerId) >=
                (state.players.length === 3 ? 1 : 2) &&
            selectedVillage.numberOfMasters() >= (state.players.length === 3 ? 2 : 3)
        ) {
            return {
                valid: false,
                reason: `Player ${playerId} has already placed enough masters in this village, or the village is too full`
            }
        }

        if (
            state.turnManager.turnCount(playerId) >= 7 &&
            selectedVillage.numberOfMastersForPlayer(playerId) == 0
        ) {
            return {
                valid: false,
                reason: `Player ${playerId} has no exiting masters in this village`
            }
        }

        return { valid: true, reason: '' }
    }
}
