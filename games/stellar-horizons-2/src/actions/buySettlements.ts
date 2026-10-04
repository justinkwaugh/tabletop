import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { capabilitiesOf } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { settlementPurchaseLimit } from '../model/settling.js'
import { TurnStep } from '../model/turn.js'

export type BuySettlementsMetadata = Type.Static<typeof BuySettlementsMetadata>
export const BuySettlementsMetadata = Type.Object({
    cost: Type.Number()
})

export type BuySettlements = Type.Static<typeof BuySettlements>
export const BuySettlements = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuySettlements),
            playerId: Type.String(),
            shipId: Type.String(),
            count: Type.Number(),
            metadata: Type.Optional(BuySettlementsMetadata)
        })
    ])
)

export const BuySettlementsValidator = Compile(BuySettlements)

export function isBuySettlements(action?: GameAction): action is BuySettlements {
    return action?.type === ActionType.BuySettlements
}

export class HydratedBuySettlements
    extends HydratableAction<typeof BuySettlements>
    implements BuySettlements
{
    declare type: ActionType.BuySettlements
    declare playerId: string
    declare shipId: string
    declare count: number
    declare metadata?: BuySettlementsMetadata

    constructor(data: BuySettlements) {
        super(data, BuySettlementsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            player.step !== TurnStep.Cargo ||
            !Number.isInteger(this.count) ||
            this.count < 1 ||
            this.count > settlementPurchaseLimit(state, ship)
        ) {
            throw Error('Invalid BuySettlements action')
        }
        const cost = this.count * capabilitiesOf(state, this.playerId).settlementCost
        player.cash -= cost
        ship.settlements += this.count
        this.metadata = { cost }
    }

    static canBuySettlements(state: HydratedStellarHorizonsGameState, playerId: string) {
        return (
            state.getPlayerState(playerId).step === TurnStep.Cargo &&
            state.shipsOf(playerId).some((ship) => settlementPurchaseLimit(state, ship) > 0)
        )
    }
}
