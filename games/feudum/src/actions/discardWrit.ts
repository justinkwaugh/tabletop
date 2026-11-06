import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { atWillWindow, reasonNoAtWillWindow } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { putWritsUnderInView } from '../model/writDeck.js'

export type DiscardWritMetadata = Type.Static<typeof DiscardWritMetadata>
export const DiscardWritMetadata = Type.Object({
    /** R-4.4.4, R-5.1 The slot it took under the deck. */
    slot: ComponentCount
})

export type DiscardWrit = Type.Static<typeof DiscardWrit>
export const DiscardWrit = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DiscardWrit),
            playerId: Type.String(),
            metadata: Type.Optional(DiscardWritMetadata),
            /** R-4.4.4 Public: a discard is shown. */
            writId: WritIdSchema
        })
    ])
)

export const DiscardWritValidator = Compile(DiscardWrit)

export function isDiscardWrit(action?: GameAction): action is DiscardWrit {
    return action?.type === ActionType.DiscardWrit
}

/** R-4.4.4, R-4.4-H1, R-4.4-H5 In an at-will window, and only an unsealed writ it holds. */
export function reasonDiscardWritRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    writId: WritId
): string | undefined {
    const closed = reasonNoAtWillWindow(state, playerId)
    if (closed) {
        return closed
    }
    return state.getPlayerState(playerId).requireWrits().includes(writId)
        ? undefined
        : "You don't hold that writ."
}

/** R-4.4.4, R-4.4-H5 The writs this seat may discard now, from its own projection. */
export function discardWritOffers(state: HydratedFeudumGameState, playerId: string): WritId[] {
    return atWillWindow(state, playerId) ? [...(state.getPlayerState(playerId).writs ?? [])] : []
}

export class HydratedDiscardWrit
    extends HydratableAction<typeof DiscardWrit>
    implements DiscardWrit
{
    declare type: ActionType.DiscardWrit
    declare playerId: string
    declare metadata?: DiscardWritMetadata
    declare writId: WritId

    constructor(data: DiscardWrit) {
        super(data, DiscardWritValidator)
    }

    /** R-4.4.4 Under the deck in view; the turn goes on. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonDiscardWritRefused(state, this.playerId, this.writId)
        if (reason) {
            throw Error(reason)
        }
        const player = state.getPlayerState(this.playerId)
        const writs = player.requireWrits()
        writs.splice(writs.indexOf(this.writId), 1)
        player.writCount -= 1
        const slot = state.writDeck.nextBottom
        putWritsUnderInView(state, [this.writId])
        this.metadata = { slot }
    }
}
