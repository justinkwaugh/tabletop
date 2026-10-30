import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { ChronicleAdded } from '../model/chronicle.js'
import { chronicleOf } from '../util/chronicleChoices.js'
import { healFromChosenStack } from '../util/chronicleCards.js'

/** What the heal put into the world deck. */
export type ChronicleHealMetadata = Type.Static<typeof ChronicleHealMetadata>
export const ChronicleHealMetadata = Type.Object({ added: ChronicleAdded })

/** R-8.4.a-H1 — six, or all it holds, drawn at random from the tied stack the winner chose. */
export type ChronicleHeal = Type.Static<typeof ChronicleHeal>
export const ChronicleHeal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleHeal),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleHealMetadata)
        })
    ])
)

export const ChronicleHealValidator = Compile(ChronicleHeal)

export function isChronicleHeal(action?: GameAction): action is ChronicleHeal {
    return action?.type === ActionType.ChronicleHeal
}

export class HydratedChronicleHeal
    extends HydratableAction<typeof ChronicleHeal>
    implements ChronicleHeal
{
    declare type: ActionType.ChronicleHeal
    declare source: ActionSource.System
    declare metadata?: ChronicleHealMetadata

    constructor(data: ChronicleHeal) {
        super(data, ChronicleHealValidator)
    }

    /** R-X.3 — the stack is shuffled before its cards are taken. */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        healFromChosenStack(state)
        const added = chronicleOf(state).added
        assertExists(added, 'R-8.4.a — the heal recorded what it added')
        this.metadata = { added: structuredClone(added) }
    }
}
