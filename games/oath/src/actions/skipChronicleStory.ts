import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { reasonCannotWriteChronicleStory } from '../util/chronicleChoices.js'

/** The winner leaves the story of the game unwritten. */
export type SkipChronicleStory = Type.Static<typeof SkipChronicleStory>
export const SkipChronicleStory = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipChronicleStory),
            playerId: Type.String()
        })
    ])
)

export const SkipChronicleStoryValidator = Compile(SkipChronicleStory)

export function isSkipChronicleStory(action?: GameAction): action is SkipChronicleStory {
    return action?.type === ActionType.SkipChronicleStory
}

export class HydratedSkipChronicleStory
    extends HydratableAction<typeof SkipChronicleStory>
    implements SkipChronicleStory
{
    declare type: ActionType.SkipChronicleStory
    declare playerId: string

    constructor(data: SkipChronicleStory) {
        super(data, SkipChronicleStoryValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotWriteChronicleStory(state, this.playerId)
        if (reason) throw Error(reason)
        this.revealsInfo = false
    }
}
