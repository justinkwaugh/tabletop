import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type LookAtPoliticsPile = Type.Static<typeof LookAtPoliticsPile>
export const LookAtPoliticsPile = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.LookAtPoliticsPile), // This action is always this type
            playerId: Type.String(), // Required now
            // Which of the two piles the player is committing to look through - per
            // the rulebook, they may look through only one, not both.
            pile: Type.Union([Type.Literal('A'), Type.Literal('B')]),
            // This is the actual information reveal (it shows every card in the
            // chosen pile, not just the one eventually taken) - undo must not be able
            // to step back past it, or a player could peek at a pile, undo, and use
            // that knowledge to change an earlier decision (which pile to open, or
            // even which action to pick before that). TakePoliticsCard, the specific
            // pick that follows, deliberately does NOT set this, so it stays freely
            // undoable on its own - a player can reconsider which card to take from
            // the same already-opened pile.
            revealsInfo: Type.Literal(true)
        })
    ])
)

export const LookAtPoliticsPileValidator = Compile(LookAtPoliticsPile)

export function isLookAtPoliticsPile(action?: GameAction): action is LookAtPoliticsPile {
    return action?.type === ActionType.LookAtPoliticsPile
}

// Crown and Scepter, step 1 of 2: the winner commits to one of the two piles before
// seeing any of its cards. See TakePoliticsCard for step 2, the specific pick.
export class HydratedLookAtPoliticsPile
    extends HydratableAction<typeof LookAtPoliticsPile>
    implements LookAtPoliticsPile
{
    declare type: ActionType.LookAtPoliticsPile
    declare playerId: string
    declare pile: 'A' | 'B'
    declare revealsInfo: true

    constructor(data: LookAtPoliticsPile) {
        super(data, LookAtPoliticsPileValidator)
    }

    apply(state: HydratedLowenherzGameState, _context?: MachineContext) {
        if (!this.isValidLookAtPoliticsPile(state)) {
            throw Error('Invalid LookAtPoliticsPile action')
        }

        state.openedPoliticsPile = this.pile
    }

    isValidLookAtPoliticsPile(state: HydratedLowenherzGameState): boolean {
        return this.invalidLookAtPoliticsPileReason(state) === undefined
    }

    // Same checks as isValidLookAtPoliticsPile, but reports WHY a pick is rejected -
    // the client uses this to show a specific message instead of one generic one.
    invalidLookAtPoliticsPileReason(state: HydratedLowenherzGameState): string | undefined {
        if (state.politicsTakingPlayerId !== this.playerId) {
            return "It isn't your turn to take a politics card."
        }

        if (state.openedPoliticsPile && state.openedPoliticsPile !== this.pile) {
            return "You've already looked through the other pile."
        }

        // Opening a pile is a one-way commitment - once openedPoliticsPile is set, the only
        // legal follow-up is taking a card FROM that pile. Committing to an empty one left
        // the phase with no legal action at all for its only active player, and there's no
        // Pass here to escape with, so the game hung.
        const pile = this.pile === 'A' ? state.politicsCardPileA : state.politicsCardPileB
        if (pile.length === 0) {
            return 'That pile is empty - look through the other one.'
        }

        return undefined
    }
}
