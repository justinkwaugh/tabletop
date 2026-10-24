import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { returnDiscardedDirectives } from '../model/directives.js'
import { TitleChange, TitleRequestKind } from '../model/pieces.js'
import { settleTitleRequests } from '../model/titles.js'
import { returnDiscardedGoods } from '../model/pools.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { queuePactAttempts } from '../model/pactResolution.js'
import { TurnPhase } from '../model/turn.js'
import { currentPhase } from '../model/turnPlan.js'
import { PhaseMetadata } from './startPhase.js'
import { isCampaign } from '../model/campaign.js'
import { discardHand, hasBoughtThisTurn, oweHandDraws } from '../model/cards.js'

export type CompletePhaseMetadata = Type.Static<typeof CompletePhaseMetadata>
export const CompletePhaseMetadata = Type.Object({
    ...PhaseMetadata.properties,
    // Players who bought nothing and so discarded their hands (rulebook 1.20).
    discardedHands: Type.Optional(Type.Array(Type.String())),
    // Titles bought or renounced in the span's Branches, settled in initiative order (5.2).
    titles: Type.Optional(Type.Array(TitleChange))
})

export type CompletePhase = Type.Static<typeof CompletePhase>
export const CompletePhase = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.CompletePhase),
            metadata: Type.Optional(CompletePhaseMetadata)
        })
    ])
)

export const CompletePhaseValidator = Compile(CompletePhase)

export function isCompletePhase(action?: GameAction): action is CompletePhase {
    return action?.type === ActionType.CompletePhase
}

export class HydratedCompletePhase
    extends HydratableAction<typeof CompletePhase>
    implements CompletePhase
{
    declare type: ActionType.CompletePhase
    declare metadata?: CompletePhaseMetadata

    constructor(data: CompletePhase) {
        super(data, CompletePhaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const phase = currentPhase(state)
        if (phase === TurnPhase.Exploration) {
            queuePactAttempts(state)
        }
        returnDiscardedGoods(state)
        returnDiscardedDirectives(state)
        const titles = settleTitleRequests(state)
        this.revealsInfo = titles.some(
            (change) => change.kind === TitleRequestKind.Buy && change.replacement !== undefined
        )
        this.metadata = {
            phase,
            ...(phase === TurnPhase.Development && isCampaign(state)
                ? { discardedHands: dealAfterDevelopment(state) }
                : {}),
            ...(titles.length > 0 ? { titles } : {})
        }
    }
}

// Rulebook 1.20: once everyone has developed, a Player who bought no tech and no card discards
// their hand, and every hand is owed what it lacks of its size.
function dealAfterDevelopment(state: HydratedStellarHorizonsGameState): string[] {
    const discarded = state
        .initiativeOrder()
        .filter(
            (playerId) => !hasBoughtThisTurn(state, playerId) && discardHand(state, playerId) > 0
        )
    for (const playerId of state.initiativeOrder()) {
        oweHandDraws(state, playerId)
    }
    return discarded
}
