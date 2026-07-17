import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type SantiagoPlayerState = Type.Static<typeof SantiagoPlayerState>
export const SantiagoPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            score: Type.Number(),
            bid: Type.Optional(Type.Number()),
            hasPersonalCanal: Type.Boolean({ default: true })
        })
    ])
)

export const SantiagoPlayerStateValidator = Compile(SantiagoPlayerState)

export class HydratedSantiagoPlayerState
    extends Hydratable<typeof SantiagoPlayerState>
    implements SantiagoPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare score: number
    declare bid?: number
    declare hasPersonalCanal: boolean

    constructor(data: SantiagoPlayerState) {
        super(data, SantiagoPlayerStateValidator)
    }

    placeBid(amount: number) {
        if (amount < 0) throw new Error('Bid cannot be negative')
        if (amount > this.money) throw new Error('Insufficient funds to place bid')
        this.bid = amount
    }

    clearBid() {
        this.bid = undefined
    }

    pay(amount: number) {
        if (amount > this.money) throw new Error('Insufficient funds')
        this.money -= amount
    }

    earn(amount: number) {
        this.money += amount
    }
}
