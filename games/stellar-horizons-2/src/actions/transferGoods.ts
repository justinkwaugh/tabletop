import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { TradeGood } from '../components/tradeGoods.js'
import { ActionType } from '../definition/actions.js'
import { CargoPartner, sameCargoPartner } from '../model/cargoTransfer.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { goodsPartners, goodsTransferLimits, transferGoods } from '../model/trade.js'

export type TransferGoods = Type.Static<typeof TransferGoods>
export const TransferGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TransferGoods),
            playerId: Type.String(),
            shipId: Type.String(),
            partner: CargoPartner,
            good: Type.Enum(TradeGood),
            count: Type.Integer()
        })
    ])
)

export const TransferGoodsValidator = Compile(TransferGoods)

export function isTransferGoods(action?: GameAction): action is TransferGoods {
    return action?.type === ActionType.TransferGoods
}

// `count` counts goods moving onto the ship; a negative number moves them off it.
export class HydratedTransferGoods
    extends HydratableAction<typeof TransferGoods>
    implements TransferGoods
{
    declare type: ActionType.TransferGoods
    declare playerId: string
    declare shipId: string
    declare partner: CargoPartner
    declare good: TradeGood
    declare count: number

    constructor(data: TransferGoods) {
        super(data, TransferGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            this.count === 0 ||
            !goodsPartners(state, ship).some((partner) => sameCargoPartner(partner, this.partner))
        ) {
            throw Error('Invalid TransferGoods action')
        }
        const limits = goodsTransferLimits(state, ship, this.partner, this.good)
        if (this.count > limits.load || -this.count > limits.unload) {
            throw Error('Invalid TransferGoods action')
        }
        transferGoods(state, ship, this.partner, this.good, this.count)
    }
}
