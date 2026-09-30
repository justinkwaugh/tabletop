import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { ActionType } from '../definition/actions.js'
import {
    applySetupChoice,
    nextSetupPlayerId,
    reasonCannotSetupChoice,
    type SetupChoiceInput
} from '../model/setup.js'
import { commitHiddenOutputs } from '../util/hiddenInputs.js'
import { discardWitnesses } from '../util/knowledge.js'

export type SetupChoiceMetadata = Type.Static<typeof SetupChoiceMetadata>
export const SetupChoiceMetadata = Type.Object({
    /** R-10.5 — the *next* region's pile, not the pawn's own. */
    discardPileRegion: Type.Enum(Region),
    discardedCardIds: Visibility.protect(Type.Array(Type.String()), {
        policy: Visibility.Policy.Actor
    })
})

export type SetupChoice = Type.Static<typeof SetupChoice>
export const SetupChoice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SetupChoice),
            playerId: Type.String(),
            /** R-1.23.1 — any one faceup site; the Chancellor's is the top Cradle. */
            siteId: Type.String(),
            /** R-1.23.2, R-9.4 */
            adviserCardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
            /** R-1.23.3, R-10.5 — in placement order. */
            discardOrder: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
                policy: Visibility.Policy.Actor
            }),
            /** R-1.16 — the Chancellor's split of a bank too short for every site's favor. */
            siteFavor: Type.Optional(
                Type.Array(Type.Object({ siteCardId: Type.String(), favor: Type.Integer() }), {
                    maxItems: 16
                })
            ),
            metadata: Type.Optional(SetupChoiceMetadata)
        })
    ])
)

export const SetupChoiceValidator = Compile(SetupChoice)

export function isSetupChoice(action?: GameAction): action is SetupChoice {
    return action?.type === ActionType.SetupChoice
}

export class HydratedSetupChoice
    extends HydratableAction<typeof SetupChoice>
    implements SetupChoice
{
    declare type: ActionType.SetupChoice
    declare playerId: string
    declare siteId: string
    declare adviserCardId: string
    declare discardOrder: string[]
    declare siteFavor?: { siteCardId: string; favor: number }[]
    declare metadata?: SetupChoiceMetadata

    constructor(data: SetupChoice) {
        super(data, SetupChoiceValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const witnesses = discardWitnesses(state)
        this.metadata = applySetupChoice(state, this.playerId, this.choice())

        this.revealsInfo = this.metadata.discardedCardIds.length > 0
        commitHiddenOutputs(this, state, witnesses)
    }

    private choice(): SetupChoiceInput {
        return {
            siteId: this.siteId,
            adviserCardId: this.adviserCardId,
            discardOrder: this.discardOrder,
            siteFavor: this.siteFavor
        }
    }

    static reasonCannotSetupChoice(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (player.siteId !== undefined) return 'player has already resolved setup'
        const next = nextSetupPlayerId(state)
        if (next !== playerId) return `R-1.23 resolves in turn order; ${next} is next`
        return undefined
    }

    static canDoSetupChoice(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedSetupChoice.reasonCannotSetupChoice(state, playerId) === undefined
    }

    /** Full validation, the cards named included. */
    static reasonCannotResolve(
        state: HydratedOathGameState,
        playerId: string,
        choice: SetupChoiceInput
    ): string | undefined {
        return reasonCannotSetupChoice(state, playerId, choice)
    }
}
