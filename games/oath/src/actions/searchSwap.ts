import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility, assert } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CardKind } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import { searchPlayModifiers } from '../util/modifiers.js'
import { revealForSearchSwap } from '../util/hiddenInputs.js'
import { swapIntoHand } from '../util/knowledge.js'

export type SearchSwapMetadata = Type.Static<typeof SearchSwapMetadata>
export const SearchSwapMetadata = Type.Object({
    /** R-9.4 — how many cards swapped is seen by everyone. */
    count: Type.Number(),
    /** R-9.4 — the cards that came in, the searcher's alone (Great Spire's Q&A on Truthful Harp). */
    incomingCardIds: Visibility.protect(Type.Array(Type.String(), { maxItems: 16 }), {
        policy: Visibility.Policy.Actor
    }),
    /** Truthful Harp — the drawn cards that went, which the table saw drawn. */
    revealedSwappedCardIds: Type.Optional(Type.Array(Type.String(), { maxItems: 16 }))
})

export type SearchSwap = Type.Static<typeof SearchSwap>
export const SearchSwap = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.SearchSwap),
            playerId: Type.String(),
            /** R-X.3 — cards come out of the vault, at random. */
            revealsInfo: Type.Literal(true),
            /** The drawn denizens that go to the Dispossessed, the searcher's alone (R-9.4). */
            swappedCardIds: Visibility.protect(
                Type.Array(Type.String(), { minItems: 1, maxItems: 16 }),
                { policy: Visibility.Policy.Actor }
            ),
            metadata: Type.Optional(SearchSwapMetadata)
        })
    ])
)

export const SearchSwapValidator = Compile(SearchSwap)

export function isSearchSwap(action?: GameAction): action is SearchSwap {
    return action?.type === ActionType.SearchSwap
}

/**
 * Great Spire — "You may swap any number of denizens you draw with random cards from the
 * Dispossessed": once, after the draw (R-5.1.2) and before the discard (R-5.1.3). Each drawn denizen
 * named trades places with a random card from the Dispossessed (R-10.25); a Vision never swaps. The
 * cards that come in join the hand, and the Search goes on with them.
 */
export class HydratedSearchSwap extends HydratableAction<typeof SearchSwap> implements SearchSwap {
    declare type: ActionType.SearchSwap
    declare playerId: string
    declare revealsInfo: true
    declare swappedCardIds: string[]
    declare metadata?: SearchSwapMetadata

    constructor(data: SearchSwap) {
        super(data, SearchSwapValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedSearchSwap.reasonCannotSwap(
            state,
            this.playerId,
            this.swappedCardIds
        )
        if (reason) {
            throw Error(`Cannot swap: ${reason}`)
        }
        const carried = searchPlayModifiers(state)
        // Truthful Harp — the draw was shown; its Q&A keeps the cards that come in hidden.
        const drawShown = carried.some((m) => m.hooks.revealsDraw)
        const reveal = revealForSearchSwap(state, this.playerId, this.swappedCardIds)
        assert(
            reveal.kind === 'peek' && reveal.cardIds.length === this.swappedCardIds.length,
            'Great Spire swaps each named card with one from the Dispossessed'
        )
        swapIntoHand(state, this.playerId, this.swappedCardIds, reveal.cardIds, drawShown)

        // R-7.4.2 — the modifier's swap is used once.
        const swaps = carried.filter((m) => m.hooks.swapsWithDispossessed)
        const rest = (state.pendingSearchModifiers ?? []).filter(
            (use) =>
                !swaps.some(
                    (m) => m.power.cardId === use.cardId && m.power.powerIndex === use.powerIndex
                )
        )
        state.pendingSearchModifiers = rest.length > 0 ? rest : undefined

        this.metadata = {
            count: reveal.cardIds.length,
            incomingCardIds: [...reveal.cardIds],
            revealedSwappedCardIds: drawShown ? [...this.swappedCardIds] : undefined
        }
    }

    static reasonCannotSwap(
        state: HydratedOathGameState,
        playerId: string,
        cardIds: readonly string[]
    ): string | undefined {
        const unavailable = HydratedSearchSwap.reasonSwapUnavailable(state, playerId)
        if (unavailable) return unavailable
        if (cardIds.length === 0) return 'name at least one drawn denizen to swap'
        if (new Set(cardIds).size !== cardIds.length) return 'a card is named twice'
        const hand = state.getPlayerState(playerId).knownHand()
        for (const cardId of cardIds) {
            if (!hand.includes(cardId)) return `${cardId} was not drawn`
            // R-5.1.2 — "denizens you draw": a Vision is never swapped.
            if (kindOf(cardId) !== CardKind.Denizen)
                return `${cardId} is not a denizen, and only drawn denizens swap`
        }
        if (cardIds.length > state.dispossessedCount) {
            return `the Dispossessed holds only ${state.dispossessedCount} cards to swap with`
        }
        return undefined
    }

    /** Read from public values alone, so each seat's view offers the swap as the host does. */
    static reasonSwapUnavailable(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (player.handCount === 0) return 'only the searcher swaps drawn cards'
        // R-7.4 — declared on this Search and carried to its swap step, which clears it once used.
        if (!searchPlayModifiers(state).some((m) => m.hooks.swapsWithDispossessed))
            return 'no Great Spire swap waits on this Search'
        if (state.dispossessedCount === 0) return 'the Dispossessed is empty'
        if (player.handCount === player.handVisions) return 'no drawn denizen to swap'
        return undefined
    }

    static canDoSearchSwap(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedSearchSwap.reasonSwapUnavailable(state, playerId) === undefined
    }
}
