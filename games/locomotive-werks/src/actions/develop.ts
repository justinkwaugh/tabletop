import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'
import { LocomotiveId, locomotiveData } from '../model/locomotives.js'

export type DevelopMetadata = Type.Static<typeof DevelopMetadata>
export const DevelopMetadata = Type.Object({
    cost: Type.Number(),
    // The Initial Orders die this development slid into Existing Orders.
    initialOrder: Type.Optional(Type.Number()),
    // The die rolled into the next locomotive's Initial Orders.
    nextLocomotiveId: Type.Optional(Type.Enum(LocomotiveId)),
    nextRoll: Type.Optional(Type.Number()),
    // Supply cards of the generation two older, removed from play.
    retiredLocomotiveId: Type.Optional(Type.Enum(LocomotiveId)),
    retiredCards: Type.Optional(Type.Number())
})

export type Develop = Type.Static<typeof Develop>
export const Develop = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Develop),
            playerId: Type.String(),
            metadata: Type.Optional(DevelopMetadata),
            locomotiveId: Type.Enum(LocomotiveId)
        })
    ])
)

export const DevelopValidator = Compile(Develop)

export function isDevelop(action?: GameAction): action is Develop {
    return action?.type === ActionType.Develop
}

export class HydratedDevelop extends HydratableAction<typeof Develop> implements Develop {
    declare type: ActionType.Develop
    declare playerId: string
    declare metadata?: DevelopMetadata
    declare locomotiveId: LocomotiveId

    constructor(data: Develop) {
        super(data, DevelopValidator)
    }

    apply(state: HydratedLwGameState, _context?: MachineContext) {
        assert(
            state.developable(this.playerId).includes(this.locomotiveId),
            'That locomotive cannot be developed'
        )
        const cost = locomotiveData(this.locomotiveId).developmentCost
        const player = state.getPlayerState(this.playerId)
        const space = state.space(this.locomotiveId)
        player.cash -= cost
        space.cards -= 1
        player.addPlant(this.locomotiveId, 1)

        const metadata: DevelopMetadata = { cost }
        const retiredLocomotiveId = state.retiredBy(this.locomotiveId)
        if (retiredLocomotiveId) {
            const retired = state.space(retiredLocomotiveId)
            metadata.retiredLocomotiveId = retiredLocomotiveId
            metadata.retiredCards = retired.cards
            retired.cards = 0
        }
        if (space.initialOrder !== undefined) {
            metadata.initialOrder = space.initialOrder
            const { next, roll } = state.releaseInitialOrder(this.locomotiveId)
            if (next !== undefined && roll !== undefined) {
                metadata.nextLocomotiveId = next
                metadata.nextRoll = roll
                this.revealsInfo = true
            }
        }
        this.metadata = metadata
    }
}
