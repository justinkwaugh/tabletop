import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { Charters, WritLimit, type WritId } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { atWillWindow, reasonNoAtWillWindow } from '../model/atWill.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { moveConcealedSeal } from '../model/seals.js'
import { WritIdSchema } from '../model/stateSchemas.js'

export type SealCharter = Type.Static<typeof SealCharter>
export const SealCharter = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SealCharter),
            playerId: Type.String(),
            /** R-4.4.3 Owner-known: the table sees only that a charter was sealed. */
            writId: Visibility.protect(WritIdSchema, { policy: Visibility.Policy.Actor })
        })
    ])
)

export const SealCharterValidator = Compile(SealCharter)

export function isSealCharter(action?: GameAction): action is SealCharter {
    return action?.type === ActionType.SealCharter
}

function isCharter(writId: WritId): boolean {
    return Charters.some((charter) => charter.id === writId)
}

/** R-4.4.3, R-4.4-H6 What's refused of a charter this seat holds; the window checked before it. */
function reasonHeldCharterRefused(
    state: HydratedFeudumGameState,
    playerId: string
): string | undefined {
    const { sealCount, sealedCharterCount } = state.getPlayerState(playerId)
    if (sealCount === 0) {
        return 'You hold no seal.'
    }
    return sealedCharterCount < WritLimit
        ? undefined
        : `You can't hold more than ${WritLimit} sealed charters.`
}

/** R-4.4.3, R-4.4-H1, R-4.4-H6 A held charter and a held seal, up to the cap of sealed charters. */
export function reasonSealCharterRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    writId: WritId
): string | undefined {
    const closed = reasonNoAtWillWindow(state, playerId)
    if (closed) {
        return closed
    }
    if (!state.getPlayerState(playerId).requireWrits().includes(writId)) {
        return "You don't hold that writ."
    }
    return isCharter(writId)
        ? reasonHeldCharterRefused(state, playerId)
        : 'Only a charter takes a seal.'
}

/** R-4.4.3 A held charter. Dimmed with `refused` when it can't be sealed now. */
export interface SealCharterOffer {
    readonly writId: WritId
    readonly refused?: string
}

/** R-4.4.3 Every charter this seat holds, in an at-will window. Read-only. */
export function sealCharterOffers(
    state: HydratedFeudumGameState,
    playerId: string
): SealCharterOffer[] {
    if (!atWillWindow(state, playerId)) {
        return []
    }
    const refused = reasonHeldCharterRefused(state, playerId)
    return (state.getPlayerState(playerId).writs ?? [])
        .filter(isCharter)
        .map((writId) => (refused ? { writId, refused } : { writId }))
}

export class HydratedSealCharter
    extends HydratableAction<typeof SealCharter>
    implements SealCharter
{
    declare type: ActionType.SealCharter
    declare playerId: string
    declare writId: WritId

    constructor(data: SealCharter) {
        super(data, SealCharterValidator)
    }

    /** R-4.4.3 A held seal, unseen, goes on the charter; the writ count is unchanged (R-4.4.4). */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonSealCharterRefused(state, this.playerId, this.writId)
        if (reason) {
            throw Error(reason)
        }
        const player = state.getPlayerState(this.playerId)
        const writs = player.requireWrits()
        writs.splice(writs.indexOf(this.writId), 1)
        player.requireSealedCharters().push(this.writId)
        moveConcealedSeal(
            state,
            { kind: 'held', playerId: this.playerId },
            { kind: 'charter', playerId: this.playerId }
        )
    }
}
