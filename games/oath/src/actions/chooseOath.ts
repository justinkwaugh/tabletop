import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathType } from '../model/oathEnums.js'
import { ActionType } from '../definition/actions.js'
import { chronicleOf, reasonCannotChooseOath, vowableOaths } from '../util/chronicleChoices.js'

/** R-8.1 — the winner vows the Oath the next game is played under. */
export type ChooseOath = Type.Static<typeof ChooseOath>
export const ChooseOath = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseOath),
            playerId: Type.String(),
            oathType: Type.Enum(OathType)
        })
    ])
)

export const ChooseOathValidator = Compile(ChooseOath)

export function isChooseOath(action?: GameAction): action is ChooseOath {
    return action?.type === ActionType.ChooseOath
}

export class HydratedChooseOath extends HydratableAction<typeof ChooseOath> implements ChooseOath {
    declare type: ActionType.ChooseOath
    declare playerId: string
    declare oathType: OathType

    constructor(data: ChooseOath) {
        super(data, ChooseOathValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotChooseOath(state, this.playerId, this.oathType)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        // The Oath played this game stays `oathType`; the record keeps both.
        chronicleOf(state).vowedOath = this.oathType
    }

    /** Whether the Vow waits on this player: any Oath but this game's is open to them. */
    static canDoChooseOath(state: HydratedOathGameState, playerId: string): boolean {
        const [any] = vowableOaths(state)
        return reasonCannotChooseOath(state, playerId, any) === undefined
    }
}
