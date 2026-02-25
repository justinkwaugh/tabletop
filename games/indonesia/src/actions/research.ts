import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type ResearchMetadata = Type.Static<typeof ResearchMetadata>
export const ResearchMetadata = Type.Object({})

export type Research = Type.Static<typeof Research>
export const Research = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Research),
            playerId: Type.String(),
            metadata: Type.Optional(ResearchMetadata)
        })
    ])
)

export const ResearchValidator = Compile(Research)

export function isResearch(action?: GameAction): action is Research {
    return action?.type === ActionType.Research
}

export class HydratedResearch extends HydratableAction<typeof Research> implements Research {
    declare type: ActionType.Research
    declare playerId: string
    declare metadata?: ResearchMetadata

    constructor(data: Research) {
        super(data, ResearchValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidResearch(state)) {
            throw Error('Invalid Research action')
        }

        this.metadata = {}
    }

    isValidResearch(state: HydratedIndonesiaGameState): boolean {
        return HydratedResearch.canResearch(state, this.playerId)
    }

    static canResearch(_state: HydratedIndonesiaGameState, _playerId: string): boolean {
        return true
    }
}
