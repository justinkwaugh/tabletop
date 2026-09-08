import { assertExists, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { Company } from '../definition/companies.js'

const moneyPolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('hiddenMoney', false, { defaultValue: false }),
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type EstatesPlayerState = Type.Static<typeof EstatesPlayerState>
export const EstatesPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            certificates: Type.Array(Type.Enum(Company)),
            money: Visibility.protect(Type.Number(), { policy: moneyPolicy }),
            stolen: Visibility.protect(Type.Number(), { policy: moneyPolicy }),
            score: Visibility.protect(Type.Number(), { policy: moneyPolicy })
        })
    ])
)

export const EstatesPlayerStateValidator = Compile(EstatesPlayerState)

export const StartingMoney = 12

export const EstatesProjectedPlayerState = Visibility.createProjectionSchema(EstatesPlayerState)
export type EstatesProjectedPlayerState = Type.Static<typeof EstatesProjectedPlayerState>
const EstatesProjectedPlayerStateValidator = Compile(EstatesProjectedPlayerState)

export class HydratedEstatesPlayerState
    extends Hydratable<typeof EstatesProjectedPlayerState>
    implements EstatesProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare certificates: Company[]
    declare money?: number
    declare stolen?: number
    declare score?: number

    constructor(data: EstatesProjectedPlayerState) {
        super(data, EstatesProjectedPlayerStateValidator)
    }
    getMoney(): number {
        assertExists(this.money, 'Player money is unavailable in this representation')
        return this.money
    }

    adjustMoney(amount: number): void {
        this.money = this.getMoney() + amount
    }

    getStolenMoney(): number {
        assertExists(this.stolen, 'Stolen money is unavailable in this representation')
        return this.stolen
    }

    getScore(): number {
        assertExists(this.score, 'Player score is unavailable in this representation')
        return this.score
    }
}
