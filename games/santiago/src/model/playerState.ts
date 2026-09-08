import { assertExists, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

import { MachineState } from '../definition/states.js'

const moneyPolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('publicMoney', true, { defaultValue: true }),
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type SantiagoPlayerState = Type.Static<typeof SantiagoPlayerState>
export const SantiagoPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Visibility.protect(Type.Number(), { policy: moneyPolicy }),
            score: Type.Number(),
            bid: Type.Optional(Type.Number()),
            hasPersonalCanal: Type.Boolean({ default: true })
        })
    ])
)

export const SantiagoPlayerStateValidator = Compile(SantiagoPlayerState)

export const SantiagoProjectedPlayerState = Visibility.createProjectionSchema(SantiagoPlayerState)
export type SantiagoProjectedPlayerState = Type.Static<typeof SantiagoProjectedPlayerState>
const SantiagoProjectedPlayerStateValidator = Compile(SantiagoProjectedPlayerState)

export class HydratedSantiagoPlayerState
    extends Hydratable<typeof SantiagoProjectedPlayerState>
    implements SantiagoProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare money?: number
    declare score: number
    declare bid?: number
    declare hasPersonalCanal: boolean

    constructor(data: SantiagoProjectedPlayerState) {
        super(data, SantiagoProjectedPlayerStateValidator)
    }

    getMoney(): number {
        assertExists(this.money, 'Player money is unavailable in this representation')
        return this.money
    }

    placeBid(amount: number) {
        if (amount < 0) throw new Error('Bid cannot be negative')
        if (amount > this.getMoney()) throw new Error('Insufficient funds to place bid')
        this.bid = amount
    }

    clearBid() {
        this.bid = undefined
    }

    pay(amount: number) {
        if (amount > this.getMoney()) throw new Error('Insufficient funds')
        this.money = this.getMoney() - amount
    }

    earn(amount: number) {
        this.money = this.getMoney() + amount
    }
}
