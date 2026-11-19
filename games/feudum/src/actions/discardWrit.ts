import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import type { WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ComponentCount, WritIdSchema } from '../model/stateSchemas.js'
import { putWritsUnderUnseen } from '../model/writDeck.js'

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
            /** R-4.4-H5 "At any time": never a turn's action, and others' Actions may follow it. */
            outOfTurn: Type.Literal(true),
            sequenced: Type.Literal(true),
            metadata: Type.Optional(DiscardWritMetadata),
            /** R-4.4.4 Actor-known: a discard goes under face down. */
            writId: Visibility.protect(WritIdSchema, { policy: Visibility.Policy.Actor })
        })
    ])
)

export const DiscardWritValidator = Compile(DiscardWrit)

/** R-4.4-H5 The fields every `DiscardWrit` carries: it may be sent at any time. */
export const DiscardAnyTime = { outOfTurn: true, sequenced: true } as const

export function isDiscardWrit(action?: GameAction): action is DiscardWrit {
    return action?.type === ActionType.DiscardWrit
}

/** R-4.4.4, R-4.4-H5 At any time until the game ends, and only a writ it holds. */
export function reasonDiscardWritRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    writId: WritId
): string | undefined {
    if (state.machineState === MachineState.EndOfGame) {
        return 'The game is over.'
    }
    return state.getPlayerState(playerId).requireWrits().includes(writId)
        ? undefined
        : "You don't hold that writ."
}

/** R-4.4.4, R-4.4-H5 The writs this seat may discard now, from its own projection. */
export function discardWritOffers(state: HydratedFeudumGameState, playerId: string): WritId[] {
    return state.machineState === MachineState.EndOfGame
        ? []
        : [...(state.getPlayerState(playerId).writs ?? [])]
}

export class HydratedDiscardWrit
    extends HydratableAction<typeof DiscardWrit>
    implements DiscardWrit
{
    declare type: ActionType.DiscardWrit
    declare playerId: string
    declare outOfTurn: true
    declare sequenced: true
    declare metadata?: DiscardWritMetadata
    declare writId: WritId

    constructor(data: DiscardWrit) {
        super(data, DiscardWritValidator)
    }

    /**
     * R-4.4.4, R-4.4-H8 Under the deck face down: only the discarder knows its slot. Play goes
     * on.
     */
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
        putWritsUnderUnseen(state, this.playerId, [this.writId])
        this.metadata = { slot }
    }
}
