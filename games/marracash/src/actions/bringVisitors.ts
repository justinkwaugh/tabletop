import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MarketColor } from '../definition/marketColor.js'
import { FountainIds, type FountainId } from '../components/board.js'
import { QueueEnd } from '../components/visitors.js'

export type BringVisitorsMetadata = Type.Static<typeof BringVisitorsMetadata>
export const BringVisitorsMetadata = Type.Object({
    visitors: Type.Array(Type.Enum(MarketColor))
})

export type BringVisitors = Type.Static<typeof BringVisitors>
export const BringVisitors = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BringVisitors),
            playerId: Type.String(),
            end: Type.Enum(QueueEnd),
            count: Type.Number(),
            entranceId: Type.Enum(FountainIds),
            metadata: Type.Optional(BringVisitorsMetadata)
        })
    ])
)

export const BringVisitorsValidator = Compile(BringVisitors)

export function isBringVisitors(action?: GameAction): action is BringVisitors {
    return action?.type === ActionType.BringVisitors
}

export class HydratedBringVisitors
    extends HydratableAction<typeof BringVisitors>
    implements BringVisitors
{
    declare type: ActionType.BringVisitors
    declare playerId: string
    declare end: QueueEnd
    declare count: number
    declare entranceId: FountainId
    declare metadata?: BringVisitorsMetadata

    constructor(data: BringVisitors) {
        super(data, BringVisitorsValidator)
    }

    apply(state: HydratedMarracashGameState) {
        if (!state.canBringVisitors(this.count, this.entranceId)) {
            throw Error(
                `Cannot bring ${this.count} visitors from the ${this.end} of the queue to fountain ${this.entranceId}`
            )
        }
        this.metadata = { visitors: state.bringVisitors(this.end, this.count, this.entranceId) }
    }
}
