import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState, type RelicSlot } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { peekRelicInVault } from '../util/hiddenInputs.js'

/** R-6.3; the Reliquary needs no Peek, since its relics are the Scepter holder's to know (R-6.4-H1). */
export enum PeekTargetKind {
    SiteRelic = 'siteRelic'
}

export type PeekTarget = Type.Static<typeof PeekTarget>
export const PeekTarget = Type.Object({
    kind: Type.Literal(PeekTargetKind.SiteRelic),
    /** R-2.8.2 — a slot, not a card id; the card is secret. */
    slotId: Type.String()
})

export type PeekMetadata = Type.Static<typeof PeekMetadata>
export const PeekMetadata = Type.Object({
    /** R-6.3 */
    relicCardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Actor }),
    revealedFromVault: Type.Boolean()
})

export type Peek = Type.Static<typeof Peek>
export const Peek = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Peek),
            playerId: Type.String(),
            target: PeekTarget,
            metadata: Type.Optional(PeekMetadata)
        })
    ])
)

export const PeekValidator = Compile(Peek)

export function isPeek(action?: GameAction): action is Peek {
    return action?.type === ActionType.Peek
}

export class HydratedPeek extends HydratableAction<typeof Peek> implements Peek {
    declare type: ActionType.Peek
    declare playerId: string
    declare target: PeekTarget
    declare metadata?: PeekMetadata

    constructor(data: Peek) {
        super(data, PeekValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const reason = HydratedPeek.reasonCannotPeek(state, this.playerId, this.target)
        if (reason) {
            throw Error(`Cannot peek: ${reason}`)
        }
        const slot = HydratedPeek.slotFor(state, this.target)
        assertExists(slot, 'A Peek requires a relic slot')

        // R-6.3 — a relic already peeked at is known to this player; only a first look reads the vault.
        const known = player.knownPeekedRelic(slot.slotId)
        const relicCardId = known ?? peekRelicInVault(state, slot.slotId)

        player.recordPeek(slot.slotId, relicCardId)
        this.revealsInfo = known === undefined
        this.metadata = { relicCardId, revealedFromVault: known === undefined }
    }

    static slotFor(state: HydratedOathGameState, target: PeekTarget): RelicSlot | undefined {
        return state.findRelicSlot(target.slotId)?.slot
    }

    static reasonCannotPeek(
        state: HydratedOathGameState,
        playerId: string,
        target: PeekTarget
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        const found = state.findRelicSlot(target.slotId)
        if (!found) {
            return `${target.slotId} is not a relic slot at any site`
        }

        // R-6.3 — "any facedown relic at your site"…
        if (found.siteId === player.siteId) {
            return undefined
        }
        if (player.peekedRelicSlotIds.includes(found.slot.slotId)) {
            return undefined
        }
        return `${target.slotId} is not at your site, and you have not peeked at it before`
    }

    /** R-6.3 */
    static legalTargets(state: HydratedOathGameState, playerId: string): PeekTarget[] {
        const targets: PeekTarget[] = []

        for (const slots of Object.values(state.relicsBySite)) {
            for (const slot of slots) {
                const target = {
                    kind: PeekTargetKind.SiteRelic as const,
                    slotId: slot.slotId
                }
                if (HydratedPeek.reasonCannotPeek(state, playerId, target) === undefined) {
                    targets.push(target)
                }
            }
        }
        return targets
    }

    static canDoPeek(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedPeek.legalTargets(state, playerId).length > 0
    }
}
