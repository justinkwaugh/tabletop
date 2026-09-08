import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'

export default {
    name: 'Sol, four players, January–February 2026',
    packageId: 'sol',
    state: './state.json',
    actions: './actions.json',
    config: { lowConflict: false, noBlue: false, noGreen: false, noYellow: false },
    variants: {
        'protected-v3'(initial, engine, game) {
            const generated = engine.generateUninitializedState(
                game,
                initial.prng.seed.toString(16).padStart(32, '0')
            )
            return {
                game: { ...game, protectedInformation: true },
                state: { ...initial, systemVersion: 3, protectedPrng: generated.protectedPrng }
            }
        }
    },
    comparisonNotes: [
        'The original Game metadata was unavailable. Configuration uses default effect-selection filters; the exact recorded setup is recovered from undo patches.',
        'Historical resume comparisons accept absent effectTracking as equivalent to its exact empty defaults. Older eligibility checks materialized those defaults; reads no longer mutate state. Final recorded comparison remains exact.',
        'Historical resume comparisons retain the first activation for each player, matching runtime lookup. Old saves contain redundant entries from appending an existing activation again; current actions no longer introduce duplicates.',
        'Protected-v3 preserves the original setup and deck order and adds private randomness. It is a controlled reconstruction, not seed-only recreation. Version and private PRNG fields are excluded from its legacy outcome comparison.'
    ],
    assertProtectedView(state) {
        assert.deepEqual(state.deck.items, [], 'Unrevealed card order must stay hidden')
    },
    normalizeState(state, phase) {
        if (phase === 'resume' && state.activations) {
            const players = new Set()
            state.activations = state.activations.filter((activation) => {
                if (players.has(activation.playerId)) return false
                players.add(activation.playerId)
                return true
            })
        }
        if (phase === 'variant') {
            delete state.systemVersion
            delete state.protectedPrng
        }
        if (
            phase === 'resume' &&
            isDeepStrictEqual(state.effectTracking, {
                outerRingLaunches: 0,
                clustersRemaining: 0,
                squeezed: false,
                movementUsed: 0,
                catapultedIds: [],
                fuelRemaining: 0,
                passageGates: []
            })
        )
            delete state.effectTracking
        return state
    }
}
