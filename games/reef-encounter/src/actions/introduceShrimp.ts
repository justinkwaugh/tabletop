import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ReefBoardIdSchema, type ReefBoardId } from '../components/reefBoards.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// Action 4: once a turn, a shrimp from the supply goes onto a coral without one.
export type IntroduceShrimp = Type.Static<typeof IntroduceShrimp>
export const IntroduceShrimp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.IntroduceShrimp),
            playerId: Type.String(),
            boardId: ReefBoardIdSchema,
            coords: OffsetCoordinates
        })
    ])
)

export const IntroduceShrimpValidator = Compile(IntroduceShrimp)

export function isIntroduceShrimp(action?: GameAction): action is IntroduceShrimp {
    return action?.type === ActionType.IntroduceShrimp
}

export class HydratedIntroduceShrimp
    extends HydratableAction<typeof IntroduceShrimp>
    implements IntroduceShrimp
{
    declare type: ActionType.IntroduceShrimp
    declare playerId: string
    declare boardId: ReefBoardId
    declare coords: OffsetCoordinates

    constructor(data: IntroduceShrimp) {
        super(data, IntroduceShrimpValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.introduceShrimp(this.playerId, { boardId: this.boardId, coords: this.coords })
    }
}
