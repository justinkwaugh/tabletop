import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Placement } from '../components/gameBoard.js'

export type RecruitStudents = Type.Static<typeof RecruitStudents>
export const RecruitStudents = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RecruitStudents),
            playerId: Type.String(),
            placement: Placement,
            metadata: Type.Optional(
                Type.Object({
                    forceSkip: Type.Boolean()
                })
            )
        })
    ])
)

export const RecruitStudentsValidator = Compile(RecruitStudents)

export function isRecruitStudents(action?: GameAction): action is RecruitStudents {
    return action?.type === ActionType.RecruitStudents
}

export class HydratedRecruitStudents
    extends HydratableAction<typeof RecruitStudents>
    implements RecruitStudents
{
    declare type: ActionType.RecruitStudents
    declare playerId: string
    declare placement: Placement
    declare metadata?: { forceSkip: boolean }

    constructor(data: RecruitStudents) {
        super(data, RecruitStudentsValidator)
    }

    apply(state: HydratedBridgesGameState) {
        const playerState = state.getPlayerState(this.playerId)

        const masterType = this.placement.masterType
        if (!playerState.hasPiece(masterType)) {
            throw Error(`Player ${this.playerId} has no ${masterType} piece to place`)
        }

        const { valid, reason } = HydratedRecruitStudents.isValidPlacement(
            state,
            this.playerId,
            this.placement
        )
        if (!valid) {
            throw Error(reason)
        }

        const village = state.board.villages[this.placement.village]
        village.addStudent(this.placement.masterType, this.playerId)
        playerState.removePiece(this.placement.masterType)
    }

    static isValidPlacement(
        state: HydratedBridgesGameState,
        playerId: string,
        placement: Placement
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(playerId)
        if (!playerState.hasPiece(placement.masterType)) {
            return {
                valid: false,
                reason: `Player ${playerId} has no ${placement.masterType} piece to place`
            }
        }

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

        if (selectedVillage.hasStudent(placement.masterType)) {
            return {
                valid: false,
                reason: `Village ${selectedVillage} ${placement.masterType} already has a student`
            }
        }

        return { valid: true, reason: '' }
    }
}
