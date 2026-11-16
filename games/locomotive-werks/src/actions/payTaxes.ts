import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedLwGameState } from '../model/gameState.js'

export const TAX_RATE_PERCENT = 10

export function taxOn(cash: number): number {
    return Math.floor((cash * TAX_RATE_PERCENT) / 100)
}

export type TaxPayment = Type.Static<typeof TaxPayment>
export const TaxPayment = Type.Object({
    playerId: Type.String(),
    tax: Type.Number(),
    cash: Type.Number()
})

export type PayTaxesMetadata = Type.Static<typeof PayTaxesMetadata>
export const PayTaxesMetadata = Type.Object({
    payments: Type.Array(TaxPayment),
    gameOver: Type.Boolean(),
    // The Player Order for the next round, when the game goes on.
    playerOrder: Type.Array(Type.String())
})

export type PayTaxes = Type.Static<typeof PayTaxes>
export const PayTaxes = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.PayTaxes),
            metadata: Type.Optional(PayTaxesMetadata)
        })
    ])
)

export const PayTaxesValidator = Compile(PayTaxes)

export function isPayTaxes(action?: GameAction): action is PayTaxes {
    return action?.type === ActionType.PayTaxes
}

export class HydratedPayTaxes extends HydratableAction<typeof PayTaxes> implements PayTaxes {
    declare type: ActionType.PayTaxes
    declare metadata?: PayTaxesMetadata

    constructor(data: PayTaxes) {
        super(data, PayTaxesValidator)
    }

    apply(state: HydratedLwGameState, _context?: MachineContext) {
        const payments = state.turnManager.turnOrder.map((playerId) => {
            const player = state.getPlayerState(playerId)
            const tax = taxOn(player.cash)
            player.cash -= tax
            return { playerId, tax, cash: player.cash }
        })
        const gameOver = state.hasWinner()
        const playerOrder = gameOver ? [] : state.orderByCash()
        if (!gameOver) {
            state.turnManager.turnOrder = playerOrder
        }
        this.metadata = { payments, gameOver, playerOrder }
    }
}
