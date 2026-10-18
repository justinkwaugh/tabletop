import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ConversionResult, conversionTargets, convertSettlement } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ConvertSettlement = Type.Static<typeof ConvertSettlement>
export const ConvertSettlement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ConvertSettlement),
            playerId: Type.String(),
            systemId: Type.String(),
            targetPlayerId: Type.String(),
            metadata: Type.Optional(ConversionResult)
        })
    ])
)

export const ConvertSettlementValidator = Compile(ConvertSettlement)

export function isConvertSettlement(action?: GameAction): action is ConvertSettlement {
    return action?.type === ActionType.ConvertSettlement
}

export class HydratedConvertSettlement
    extends HydratableAction<typeof ConvertSettlement>
    implements ConvertSettlement
{
    declare type: ActionType.ConvertSettlement
    declare playerId: string
    declare systemId: string
    declare targetPlayerId: string
    declare metadata?: ConversionResult

    constructor(data: ConvertSettlement) {
        super(data, ConvertSettlementValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const isTarget = conversionTargets(state, this.playerId).some(
            (base) => base.systemId === this.systemId && base.playerId === this.targetPlayerId
        )
        if (!isTarget) {
            throw Error('Invalid ConvertSettlement action')
        }
        this.metadata = convertSettlement(state, this.playerId, this.systemId, this.targetPlayerId)
        this.revealsInfo = true
    }
}
