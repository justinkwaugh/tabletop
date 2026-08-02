import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

// Always empty right after apply() - ResolvingActionsStateHandler.onAction fills this
// in afterward (once it knows what actually happened this step), the same
// apply-then-onAction-mutates-metadata pattern StartOfTurnStateHandler already uses for
// DrawActionCard's hillScoring. Exactly one of the "what happened" groups below is set
// per instance; UI history uses whichever is present to describe this step.
export type AdvanceResolutionMetadata = Type.Static<typeof AdvanceResolutionMetadata>
export const AdvanceResolutionMetadata = Type.Object({
    slot: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])),
    // Money Bag split among every chooser (or a no-op note if no one chose it).
    moneyBagRecipientIds: Type.Optional(Type.Array(Type.String())),
    moneyBagAmountEach: Type.Optional(Type.Number()),
    // A slot resolved outright (no tie) - winnerPlayerId absent means no one chose it.
    slotResolved: Type.Optional(Type.Boolean()),
    slotWinnerPlayerId: Type.Optional(Type.String()),
    // Set alongside slotWinnerPlayerId when the won slot was a border/knight band -
    // lets history say what they actually won (and, if placementSkippedReason is
    // set, why they immediately lost the chance to act on it), since by the time
    // history is read, wallsRemaining/knightsRemaining have long since moved on.
    bandKind: Type.Optional(Type.Union([Type.Literal('border'), Type.Literal('knight')])),
    bandCount: Type.Optional(Type.Number()),
    placementSkippedReason: Type.Optional(
        Type.Union([Type.Literal('regionCap'), Type.Literal('noKnightsInStock'), Type.Literal('noLegalWallSpots')])
    ),
    // A tie sent this slot to negotiation (2 tied) or a duel (3+ tied) instead.
    tiedPlayerIds: Type.Optional(Type.Array(Type.String())),
    tieWentToDuel: Type.Optional(Type.Boolean()),
    // Set on the final AdvanceResolution once all 3 slots are done and the round rolls
    // over to the next player's turn - newFirstPlayerId is who becomes first player for
    // the new round (see advanceRound), so history can name them.
    roundAdvanced: Type.Optional(Type.Boolean()),
    newFirstPlayerId: Type.Optional(Type.String())
})

// A system-only action - never submitted by a real player (see ResolvingActionsStateHandler,
// which enqueues it via context.addSystemAction every time it's entered). playerId is
// always '' so the generic engine's active-player check is bypassed rather than tied to
// whichever player happens to be active at the time.
export type AdvanceResolution = Type.Static<typeof AdvanceResolution>
export const AdvanceResolution = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AdvanceResolution),
            playerId: Type.String(),
            metadata: Type.Optional(AdvanceResolutionMetadata)
        })
    ])
)

export const AdvanceResolutionValidator = Compile(AdvanceResolution)

export function isAdvanceResolution(action?: GameAction): action is AdvanceResolution {
    return action?.type === ActionType.AdvanceResolution
}

export class HydratedAdvanceResolution
    extends HydratableAction<typeof AdvanceResolution>
    implements AdvanceResolution
{
    declare type: ActionType.AdvanceResolution
    declare playerId: string
    declare metadata?: AdvanceResolutionMetadata

    constructor(data: AdvanceResolution) {
        super(data, AdvanceResolutionValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        // All the real work happens in ResolvingActionsStateHandler.onAction, which has
        // access to the MachineContext needed to enqueue further cascaded actions.
        this.metadata = {}
    }
}
