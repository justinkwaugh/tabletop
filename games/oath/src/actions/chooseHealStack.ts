import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { ActionType } from '../definition/actions.js'
import { chronicleOf, reasonCannotChooseHealStack } from '../util/chronicleChoices.js'

/**
 * R-8.4.a-H1 — the winner chooses which of the tied largest Dispossessed stacks heals the Archive;
 * the cards are then drawn from it at random.
 */
export type ChooseHealStack = Type.Static<typeof ChooseHealStack>
export const ChooseHealStack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseHealStack),
            playerId: Type.String(),
            suit: Type.Enum(Suit)
        })
    ])
)

export const ChooseHealStackValidator = Compile(ChooseHealStack)

export function isChooseHealStack(action?: GameAction): action is ChooseHealStack {
    return action?.type === ActionType.ChooseHealStack
}

export class HydratedChooseHealStack
    extends HydratableAction<typeof ChooseHealStack>
    implements ChooseHealStack
{
    declare type: ActionType.ChooseHealStack
    declare playerId: string
    declare suit: Suit

    constructor(data: ChooseHealStack) {
        super(data, ChooseHealStackValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotChooseHealStack(state, this.playerId, this.suit)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        chronicleOf(state).healSuit = this.suit
    }

    static canDoChooseHealStack(state: HydratedOathGameState, playerId: string): boolean {
        const [any] = state.chronicle?.healTie?.suits ?? []
        return any !== undefined && reasonCannotChooseHealStack(state, playerId, any) === undefined
    }
}
