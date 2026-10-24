import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TitleId } from '../components/titles.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TitleActionMetadata } from '../model/pieces.js'
import { buyTitle, canBuyTitle } from '../model/titles.js'

export type BuyTitle = Type.Static<typeof BuyTitle>
export const BuyTitle = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyTitle),
            playerId: Type.String(),
            titleId: Type.Enum(TitleId),
            metadata: Type.Optional(TitleActionMetadata)
        })
    ])
)

export const BuyTitleValidator = Compile(BuyTitle)

export function isBuyTitle(action?: GameAction): action is BuyTitle {
    return action?.type === ActionType.BuyTitle
}

// Rulebook 5.2: a title bought for its influence once its prerequisite is met.
export class HydratedBuyTitle extends HydratableAction<typeof BuyTitle> implements BuyTitle {
    declare type: ActionType.BuyTitle
    declare playerId: string
    declare titleId: TitleId
    declare metadata?: TitleActionMetadata

    constructor(data: BuyTitle) {
        super(data, BuyTitleValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!canBuyTitle(state, this.playerId, this.titleId)) {
            throw Error('Invalid BuyTitle action')
        }
        const change = buyTitle(state, this.playerId, this.titleId)
        this.metadata = change ? { queued: false, change } : { queued: true }
        this.revealsInfo = change?.replacement !== undefined
    }
}
