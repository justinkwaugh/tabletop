import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { SettledMarkers, settleEarnedMarkers } from '../model/settlement.js'

export type SettleExplorationsMetadata = Type.Static<typeof SettleExplorationsMetadata>
export const SettleExplorationsMetadata = Type.Object({
    settled: Type.Array(SettledMarkers)
})

export type SettleExplorations = Type.Static<typeof SettleExplorations>
export const SettleExplorations = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SettleExplorations),
            playerId: Type.String(),
            metadata: Type.Optional(SettleExplorationsMetadata)
        })
    ])
)

export const SettleExplorationsValidator = Compile(SettleExplorations)

export function isSettleExplorations(action?: GameAction): action is SettleExplorations {
    return action?.type === ActionType.SettleExplorations
}

export class HydratedSettleExplorations
    extends HydratableAction<typeof SettleExplorations>
    implements SettleExplorations
{
    declare type: ActionType.SettleExplorations
    declare playerId: string
    declare metadata?: SettleExplorationsMetadata

    constructor(data: SettleExplorations) {
        super(data, SettleExplorationsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { settled: settleEarnedMarkers(state, this.playerId) }
        this.revealsInfo = true
    }
}
