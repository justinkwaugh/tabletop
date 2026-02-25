import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ResearchArea } from '../definition/researchAreas.js'

export type ResearchMetadata = Type.Static<typeof ResearchMetadata>
export const ResearchMetadata = Type.Object({
    oldLevel: Type.Number(),
    newLevel: Type.Number()
})

export type Research = Type.Static<typeof Research>
export const Research = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Research),
            playerId: Type.String(),
            metadata: Type.Optional(ResearchMetadata),
            targetPlayerId: Type.String(),
            researchArea: Type.Enum(ResearchArea)
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
    declare targetPlayerId: string
    declare researchArea: ResearchArea

    constructor(data: Research) {
        super(data, ResearchValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidResearch(state)) {
            throw Error('Invalid Research action')
        }

        const targetPlayerState = state.getPlayerState(this.targetPlayerId)
        const currentLevel = targetPlayerState.research[this.researchArea]
        const newLevel = currentLevel + 1
        targetPlayerState.research[this.researchArea] = newLevel

        this.metadata = {
            oldLevel: currentLevel,
            newLevel: newLevel
        }
    }

    isValidResearch(state: HydratedIndonesiaGameState): boolean {
        if (this.targetPlayerId !== this.playerId && this.researchArea !== ResearchArea.hull) {
            return false
        }
        const targetPlayerState = state.getPlayerState(this.targetPlayerId)
        const currentLevel = targetPlayerState.research[this.researchArea]
        return currentLevel < 4
    }

    static canResearch(_state: HydratedIndonesiaGameState, _playerId: string): boolean {
        return true
    }
}
