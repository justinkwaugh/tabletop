import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// At setup each player secretly feeds one of their dealt polyps to their parrotfish.
export type FeedParrotfish = Type.Static<typeof FeedParrotfish>
export const FeedParrotfish = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FeedParrotfish),
            playerId: Type.String(),
            color: Visibility.protect(Type.Enum(CoralColor), { policy: Visibility.Policy.Actor })
        })
    ])
)

export const FeedParrotfishValidator = Compile(FeedParrotfish)

export function isFeedParrotfish(action?: GameAction): action is FeedParrotfish {
    return action?.type === ActionType.FeedParrotfish
}

export class HydratedFeedParrotfish
    extends HydratableAction<typeof FeedParrotfish>
    implements FeedParrotfish
{
    declare type: ActionType.FeedParrotfish
    declare playerId: string
    declare color: CoralColor

    constructor(data: FeedParrotfish) {
        super(data, FeedParrotfishValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.getPlayerState(this.playerId).feedParrotfish(this.color)
    }
}
