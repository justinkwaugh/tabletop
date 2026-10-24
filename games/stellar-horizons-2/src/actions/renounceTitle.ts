import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TitleId } from '../components/titles.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TitleActionMetadata } from '../model/pieces.js'
import { canRenounceTitle, renounceTitle } from '../model/titles.js'

export type RenounceTitle = Type.Static<typeof RenounceTitle>
export const RenounceTitle = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RenounceTitle),
            playerId: Type.String(),
            titleId: Type.Enum(TitleId),
            metadata: Type.Optional(TitleActionMetadata)
        })
    ])
)

export const RenounceTitleValidator = Compile(RenounceTitle)

export function isRenounceTitle(action?: GameAction): action is RenounceTitle {
    return action?.type === ActionType.RenounceTitle
}

// Rulebook 5.2: a title may be renounced at any time.
export class HydratedRenounceTitle
    extends HydratableAction<typeof RenounceTitle>
    implements RenounceTitle
{
    declare type: ActionType.RenounceTitle
    declare playerId: string
    declare titleId: TitleId
    declare metadata?: TitleActionMetadata

    constructor(data: RenounceTitle) {
        super(data, RenounceTitleValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!canRenounceTitle(state, this.playerId, this.titleId)) {
            throw Error('Invalid RenounceTitle action')
        }
        const change = renounceTitle(state, this.playerId, this.titleId)
        this.metadata = change ? { queued: false, change } : { queued: true }
    }
}
