import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'

export default {
    name: 'Fresh Fish, four players, May–August 2025',
    packageId: 'fresh-fish',
    state: './state.json',
    actions: './actions.json',
    config: { forceThreeDisks: true, auctioneerWinsTie: false, boardSeed: 3948031636 },
    variants: {
        'protected-v3'(initial, engine, game) {
            const generated = engine.generateUninitializedState(
                game,
                initial.prng.seed.toString(16).padStart(32, '0')
            )
            return {
                game: { ...game, protectedInformation: true },
                state: {
                    ...initial,
                    systemVersion: 3,
                    protectedPrng: generated.protectedPrng,
                    boardSeed: game.config.boardSeed
                }
            }
        }
    },
    comparisonNotes: [
        'Protected-v3 preserves the recovered setup and adds fresh private randomness. It is a controlled reconstruction, not seed-only recreation. Its version, PRNG states, boardSeed and generated-action checksum are excluded from the legacy outcome comparison.',
        'The original Game metadata was unavailable. Auctioneer loses ties is inferred from the history; forceThreeDisks uses the default because either setting permits these moves.',
        'The original board seed is unknown. The recorded PRNG seed is used as a configuration placeholder; the initial board comes from undo patches.',
        'Old draw bags retain consumed items after remaining. Compare only remaining items.',
        'Only the known alternative blue ice-cream route is accepted in the final State; all other paths, distances, scores and money must match.',
        'Historical resume comparisons omit recalculated scores/distances and the newer auction submitted field.'
    ],
    assertProtectedView(state) {
        assert.deepEqual(state.tileBag.items, [], 'Unrevealed tile order must stay hidden')
    },
    normalizeState(state, phase) {
        if (phase === 'variant') {
            for (const key of [
                'systemVersion',
                'prng',
                'protectedPrng',
                'boardSeed',
                'actionChecksum'
            ])
                delete state[key]
        }
        state.tileBag.items = state.tileBag.items.slice(0, state.tileBag.remaining)
        for (const player of state.players) {
            if (phase === 'resume') delete player.score
            for (const stall of player.stalls) {
                if (phase === 'resume') {
                    delete stall.path
                    delete stall.distance
                } else if (
                    player.playerId === '55q8UNHldxUYUmZBUOnwV' &&
                    stall.goodsType === 'icecream' &&
                    isDeepStrictEqual(stall.path, [
                        [3, 9],
                        [2, 9],
                        [2, 8],
                        [2, 7],
                        [2, 6],
                        [1, 6]
                    ])
                ) {
                    stall.path = [
                        [3, 9],
                        [2, 9],
                        [2, 8],
                        [2, 7],
                        [1, 7],
                        [1, 6]
                    ]
                }
            }
        }
        if (phase === 'resume') {
            for (const participant of state.currentAuction?.participants ?? []) {
                delete participant.submitted
            }
        }
        return state
    }
}
