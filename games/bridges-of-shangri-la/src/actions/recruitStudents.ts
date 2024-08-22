import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Placement } from '../components/gameBoard.js'
import { HydratedBridgesPlayerState } from '../model/playerState.js'

export type RecruitStudents = Static<typeof RecruitStudents>
export const RecruitStudents = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.RecruitStudents),
        playerId: Type.String(),
        studentOne: Type.Optional(Placement),
        studentTwo: Type.Optional(Placement)
    })
])

export const RecruitStudentsValidator = TypeCompiler.Compile(RecruitStudents)

export function isRecruitStudents(action?: GameAction): action is RecruitStudents {
    return action?.type === ActionType.RecruitStudents
}

export class HydratedRecruitStudents
    extends HydratableAction<typeof RecruitStudents>
    implements RecruitStudents
{
    declare type: ActionType.RecruitStudents
    declare playerId: string
    declare studentOne: Placement
    declare studentTwo?: Placement

    constructor(data: RecruitStudents) {
        super(data, RecruitStudentsValidator)
    }

    apply(state: HydratedBridgesGameState) {
        const playerState = state.getPlayerState(this.playerId)

        this.placeStudent(state, playerState, this.studentOne)

        if (this.studentTwo) {
            this.placeStudent(state, playerState, this.studentTwo)
        }
    }

    placeStudent(
        state: HydratedBridgesGameState,
        playerState: HydratedBridgesPlayerState,
        placement: Placement
    ) {
        const masterType = placement.masterType
        if (!playerState.hasPiece(masterType)) {
            throw Error(`Player ${this.playerId} has no ${masterType} piece to place`)
        }

        const { valid, reason } = HydratedRecruitStudents.isValidPlacement(
            state,
            this.playerId,
            placement
        )
        if (!valid) {
            throw Error(reason)
        }

        const village = state.board.villages[placement.village]
        village.addStudent(placement.masterType, this.playerId)
        playerState.removePiece(placement.masterType)
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

        if (!selectedVillage.isMasterOwnedByPlayer(placement.masterType, playerId)) {
            return {
                valid: false,
                reason: `Village ${selectedVillage} ${placement.masterType} is not owned by player ${playerId}`
            }
        }

        return { valid: true, reason: '' }
    }
}
