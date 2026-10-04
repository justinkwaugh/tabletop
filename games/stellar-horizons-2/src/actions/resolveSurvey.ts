import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { SurveyResolution, resolveNextSurvey } from '../model/surveys.js'

export type ResolveSurvey = Type.Static<typeof ResolveSurvey>
export const ResolveSurvey = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveSurvey),
            metadata: Type.Optional(SurveyResolution)
        })
    ])
)

export const ResolveSurveyValidator = Compile(ResolveSurvey)

export function isResolveSurvey(action?: GameAction): action is ResolveSurvey {
    return action?.type === ActionType.ResolveSurvey
}

export class HydratedResolveSurvey
    extends HydratableAction<typeof ResolveSurvey>
    implements ResolveSurvey
{
    declare type: ActionType.ResolveSurvey
    declare metadata?: SurveyResolution

    constructor(data: ResolveSurvey) {
        super(data, ResolveSurveyValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const resolution = resolveNextSurvey(state)
        this.metadata = resolution
        if (resolution.drawnTileId !== undefined) {
            this.revealsInfo = true
        }
    }
}
