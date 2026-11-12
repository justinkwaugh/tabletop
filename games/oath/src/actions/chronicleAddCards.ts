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
import { Suit } from '../model/oathEnums.js'
import { ChronicleAdded, ChronicleHealTie } from '../model/chronicle.js'
import { chronicleOf, chronicleSuitLeaders } from '../util/chronicleChoices.js'
import { addSixOrHeal } from '../util/chronicleCards.js'

/** The suit, whether the winner chose it, and what the step added or the tie it published. */
export type ChronicleAddCardsMetadata = Type.Static<typeof ChronicleAddCardsMetadata>
export const ChronicleAddCardsMetadata = Type.Object({
    /** R-8.4 — the suit the six were counted from. */
    suit: Type.Enum(Suit),
    /** The winner chose it among tied suits: their choice's row already says what it added. */
    chosen: Type.Boolean(),
    /** What went into the world deck; absent while a tie for the largest stack waits on the winner. */
    added: Type.Optional(ChronicleAdded),
    /** R-8.4.a-H1 — the stacks tied for the most, published. */
    healTie: Type.Optional(ChronicleHealTie)
})

/** R-8.4, R-8.4.a — six denizens from the Archive into the world deck, or a heal from the Dispossessed. */
export type ChronicleAddCards = Type.Static<typeof ChronicleAddCards>
export const ChronicleAddCards = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleAddCards),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleAddCardsMetadata)
        })
    ])
)

export const ChronicleAddCardsValidator = Compile(ChronicleAddCards)

export function isChronicleAddCards(action?: GameAction): action is ChronicleAddCards {
    return action?.type === ActionType.ChronicleAddCards
}

export class HydratedChronicleAddCards
    extends HydratableAction<typeof ChronicleAddCards>
    implements ChronicleAddCards
{
    declare type: ActionType.ChronicleAddCards
    declare source: ActionSource.System
    declare metadata?: ChronicleAddCardsMetadata

    constructor(data: ChronicleAddCards) {
        super(data, ChronicleAddCardsValidator)
    }

    /** R-X.3 — the Archive's stacks are shuffled, or the Dispossessed sorted in front of everyone. */
    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = true
        const chronicle = chronicleOf(state)
        const suit = chronicle.suit
        assertExists(suit, 'R-8.4 — the suit is known before the six are added')
        // The suit step just before this one asked the winner only when suits tied.
        const chosen = chronicleSuitLeaders(state).length > 1
        addSixOrHeal(state)
        this.metadata = {
            suit,
            chosen,
            ...(chronicle.added ? { added: structuredClone(chronicle.added) } : {}),
            ...(chronicle.healTie ? { healTie: structuredClone(chronicle.healTie) } : {})
        }
    }
}
