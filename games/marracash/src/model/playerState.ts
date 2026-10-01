import { assertExists, Color, Hydratable, PlayerState, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Antique } from '../components/antiques.js'
import { MachineState } from '../definition/states.js'

export const StartingMoney = 1200

const moneyPolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('concealedCash', false, { defaultValue: false }),
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type MarracashPlayerState = Type.Static<typeof MarracashPlayerState>
export const MarracashPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Visibility.protect(Type.Number(), { policy: moneyPolicy }),
            antiques: Visibility.protect(Type.Array(Antique), {
                policy: Visibility.Policy.Owner,
                redaction: Visibility.redaction.emptyArray()
            })
        })
    ])
)

export const MarracashPlayerStateValidator = Compile(MarracashPlayerState)

export const MarracashProjectedPlayerState = Visibility.createProjectionSchema(MarracashPlayerState)
export type MarracashProjectedPlayerState = Type.Static<typeof MarracashProjectedPlayerState>
const MarracashProjectedPlayerStateValidator = Compile(MarracashProjectedPlayerState)

export class HydratedMarracashPlayerState
    extends Hydratable<typeof MarracashProjectedPlayerState>
    implements MarracashProjectedPlayerState
{
    declare playerId: string
    declare color: Color
    declare money?: number
    declare antiques: Antique[]

    constructor(data: MarracashProjectedPlayerState) {
        super(data, MarracashProjectedPlayerStateValidator)
    }

    getMoney(): number {
        assertExists(this.money, 'Player money is unavailable in this representation')
        return this.money
    }
}
