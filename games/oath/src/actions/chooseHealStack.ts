import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { ChronicleAdded } from '../model/chronicle.js'
import { ActionType } from '../definition/actions.js'
import { chronicleOf, reasonCannotChooseHealStack } from '../util/chronicleChoices.js'
import { healCount } from '../util/chronicleCards.js'

export type ChooseHealStackMetadata = Type.Static<typeof ChooseHealStackMetadata>
export const ChooseHealStackMetadata = Type.Object({
    /** R-8.4.a — the suit and how many the heal adds, drawn by the System Action that follows. */
    added: ChronicleAdded
})

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
            suit: Type.Enum(Suit),
            metadata: Type.Optional(ChooseHealStackMetadata)
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
    declare metadata?: ChooseHealStackMetadata

    constructor(data: ChooseHealStack) {
        super(data, ChooseHealStackValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotChooseHealStack(state, this.playerId, this.suit)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        const chronicle = chronicleOf(state)
        const tie = chronicle.healTie
        assertExists(tie, 'R-8.4.a-H1 — the tie is published')
        chronicle.healSuit = this.suit
        this.metadata = { added: { heal: { suit: this.suit, count: healCount(tie.count) } } }
    }

    static canDoChooseHealStack(state: HydratedOathGameState, playerId: string): boolean {
        const [any] = state.chronicle?.healTie?.suits ?? []
        return any !== undefined && reasonCannotChooseHealStack(state, playerId, any) === undefined
    }
}
