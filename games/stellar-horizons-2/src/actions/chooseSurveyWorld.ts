import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { applySurveyChoice, surveySwapSlots } from '../model/surveys.js'

export type ChooseSurveyWorldMetadata = Type.Static<typeof ChooseSurveyWorldMetadata>
export const ChooseSurveyWorldMetadata = Type.Object({
    systemId: Type.String(),
    drawnTileId: Type.String(),
    replacedTileId: Type.Optional(Type.String())
})

export type ChooseSurveyWorld = Type.Static<typeof ChooseSurveyWorld>
export const ChooseSurveyWorld = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseSurveyWorld),
            playerId: Type.String(),
            slot: Type.Optional(Type.Number()),
            metadata: Type.Optional(ChooseSurveyWorldMetadata)
        })
    ])
)

export const ChooseSurveyWorldValidator = Compile(ChooseSurveyWorld)

export function isChooseSurveyWorld(action?: GameAction): action is ChooseSurveyWorld {
    return action?.type === ActionType.ChooseSurveyWorld
}

export class HydratedChooseSurveyWorld
    extends HydratableAction<typeof ChooseSurveyWorld>
    implements ChooseSurveyWorld
{
    declare type: ActionType.ChooseSurveyWorld
    declare playerId: string
    declare slot?: number
    declare metadata?: ChooseSurveyWorldMetadata

    constructor(data: ChooseSurveyWorld) {
        super(data, ChooseSurveyWorldValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const choice = state.surveyChoice
        if (
            !choice ||
            choice.playerId !== this.playerId ||
            (this.slot !== undefined &&
                !surveySwapSlots(state, choice.systemId, choice.drawnTileId).includes(this.slot))
        ) {
            throw Error('Invalid ChooseSurveyWorld action')
        }
        const replaced = applySurveyChoice(state, this.slot)
        this.metadata = {
            systemId: choice.systemId,
            drawnTileId: choice.drawnTileId,
            replacedTileId: replaced?.tileId
        }
    }
}
