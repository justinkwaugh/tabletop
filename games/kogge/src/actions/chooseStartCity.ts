import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type ChooseStartCity = Type.Static<typeof ChooseStartCity>
export const ChooseStartCity = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseStartCity),
            playerId: Type.String(),
            city: Visibility.protect(Type.Integer({ minimum: 0 }), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const ChooseStartCityValidator = Compile(ChooseStartCity)

export function isChooseStartCity(action?: GameAction): action is ChooseStartCity {
    return action?.type === ActionType.ChooseStartCity
}

export class HydratedChooseStartCity
    extends HydratableAction<typeof ChooseStartCity>
    implements ChooseStartCity
{
    declare type: ActionType.ChooseStartCity
    declare playerId: string
    declare city: number

    constructor(data: ChooseStartCity) {
        super(data, ChooseStartCityValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.startCityOptions(this.playerId).includes(this.city)) {
            throw Error('Invalid ChooseStartCity action')
        }
        const choice = state.startChoice(this.playerId)
        assertExists(choice, `${this.playerId} has no start city to choose`)
        choice.city = this.city
        choice.submitted = true
    }

    static canChooseStartCity(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.startCityOptions(playerId).length > 0
    }
}
