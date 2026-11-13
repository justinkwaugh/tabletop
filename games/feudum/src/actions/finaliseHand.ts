import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility
} from '@tabletop/common'
import { ActionCards, type ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState } from '../model/playerState.js'
import { ActionCardKindSchema } from '../model/stateSchemas.js'

/** R-3.1 */
export const HandSize = 4
/** R-3.3 With a saltpeter on the pouch. */
export const ExtraActionHandSize = 5

export type PouchGood = Type.Static<typeof PouchGood>
export const PouchGood = Type.Union([Type.Literal('saltpeter'), Type.Literal('sulfur')])

export type FinaliseHand = Type.Static<typeof FinaliseHand>
export const FinaliseHand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.FinaliseHand),
            playerId: Type.String(),
            /** R-X.2 A finalised hand is always a barrier. */
            revealsInfo: Type.Literal(true),
            /** R-3.1 Actor-known: the table learns only the count. */
            cards: Visibility.protect(Type.Array(ActionCardKindSchema), {
                policy: Visibility.Policy.Actor
            }),
            /** R-3.1-H1 Actor-known: `RevealPouches` tells the table once every seat has finalised. */
            pouchGood: Visibility.protect(Type.Optional(PouchGood), {
                policy: Visibility.Policy.Actor
            })
        })
    ])
)

export const FinaliseHandValidator = Compile(FinaliseHand)

export function isFinaliseHand(action?: GameAction): action is FinaliseHand {
    return action?.type === ActionType.FinaliseHand
}

/**
 * R-3.1-H1 Every seat finalises at once, so a round's finalises share one simultaneous group:
 * a seat sending from a state another seat's finalise has since moved on is still taken.
 */
export function handSelectionGroup(state: HydratedFeudumGameState): string {
    return `hands-${state.roundManager.currentRound?.number ?? 0}`
}

/** R-3.1, R-3.3 */
export function handSizeFor(pouchGood?: PouchGood): number {
    return pouchGood === 'saltpeter' ? ExtraActionHandSize : HandSize
}

/** R-3.3 From the personal supply; sulfur from the wine barrel may not be used. */
export function reasonPouchRefused(
    player: HydratedFeudumPlayerState,
    pouchGood: PouchGood
): string | undefined {
    if (player.goods[pouchGood] > 0) {
        return undefined
    }
    return pouchGood === 'sulfur' && player.barrel > 0
        ? "Barrel sulfur can't go in the pouch."
        : `You hold no ${pouchGood}.`
}

/** R-3.1, R-3.3 */
function reasonHandRefused(
    player: HydratedFeudumPlayerState,
    cards: readonly ActionCardKind[],
    pouchGood?: PouchGood
): string | undefined {
    const pouchRefused = pouchGood && reasonPouchRefused(player, pouchGood)
    if (pouchRefused) {
        return pouchRefused
    }
    const required = handSizeFor(pouchGood)
    if (cards.length !== required) {
        return `Choose ${required} cards, not ${cards.length}.`
    }
    return new Set(cards).size === cards.length ? undefined : 'Choose different cards.'
}

/** R-3.1-H1, then R-3.1, R-3.3 Any seat yet to finalise may, in any order. */
export function reasonFinaliseRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    cards: readonly ActionCardKind[],
    pouchGood?: PouchGood
): string | undefined {
    const { selection } = state.flow
    if (!selection) {
        return 'No hand is being chosen.'
    }
    if (selection.finalised.includes(playerId)) {
        return 'Your hand is already final.'
    }
    return reasonHandRefused(state.getPlayerState(playerId), cards, pouchGood)
}

export interface FinaliseHandPreview {
    readonly chosen: number
    readonly required: number
    readonly reason?: string
    /** R-3.13-H1 A warning, not a refusal: the other cards could all be played before it. */
    readonly conquerMayEndLast: boolean
    /** R-X.2 */
    readonly revealsInfo: true
}

/** R-3.1, R-3.3, R-3.13-H1 What a seat's draft would do if sent. */
export function previewFinaliseHand(
    state: HydratedFeudumGameState,
    playerId: string,
    draft: { readonly cards: readonly ActionCardKind[]; readonly pouchGood?: PouchGood }
): FinaliseHandPreview {
    const reason = reasonFinaliseRefused(state, playerId, draft.cards, draft.pouchGood)
    return {
        chosen: draft.cards.length,
        required: handSizeFor(draft.pouchGood),
        ...(reason ? { reason } : {}),
        conquerMayEndLast: ActionCards.some(
            (card) => card.symbols.notLast && draft.cards.includes(card.kind)
        ),
        revealsInfo: true
    }
}

export class HydratedFinaliseHand
    extends HydratableAction<typeof FinaliseHand>
    implements FinaliseHand
{
    declare type: ActionType.FinaliseHand
    declare playerId: string
    declare revealsInfo: true
    declare cards: ActionCardKind[]
    declare pouchGood?: PouchGood

    constructor(data: FinaliseHand) {
        super(data, FinaliseHandValidator)
    }

    /**
     * R-3.1, R-3.3, R-3.1-H1 The hand and the pouch good are owner-known until `RevealPouches`: the
     * good stays in the supply and the hand's size is not told, so the table learns only that the
     * seat has finalised. The input names every fact its history line needs.
     */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonFinaliseRefused(state, this.playerId, this.cards, this.pouchGood)
        if (reason) {
            throw Error(reason)
        }
        const { selection } = state.flow
        assertExists(selection, 'R-3.1-H1 A hand is being chosen')
        const player = state.getPlayerState(this.playerId)
        player.hand = [...this.cards]
        if (this.pouchGood) {
            player.committedPouch = this.pouchGood
        }
        selection.finalised.push(this.playerId)
    }
}
