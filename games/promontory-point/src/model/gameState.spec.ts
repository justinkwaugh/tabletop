import { Visibility, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PROMONTORY } from '../components/board.js'
import { Definition } from '../definition/definition.js'
import { PromontoryPointRuntime } from '../definition/runtime.js'
import { VARIANT_OFF_AND_ON, canonical, startGame } from '../testing/startGame.js'
import {
    PromontoryPointGameState,
    PromontoryPointGameStateValidator,
    type PromontoryPointProjectedState
} from './gameState.js'

const projector = Visibility.createProjector(PromontoryPointGameState)
const spectator = { kind: 'spectator' } as const

function project(
    state: PromontoryPointGameState,
    game: Game,
    perspective: Visibility.Perspective
): PromontoryPointProjectedState {
    return projector.project(state, perspective, { config: game.config })
}

function hydrate(state: PromontoryPointProjectedState) {
    return Definition.runtime.hydrator.hydrateState(structuredClone(state))
}

function accepts(change: (state: PromontoryPointGameState) => void): boolean {
    const state = structuredClone(startGame().state)
    change(state)
    return PromontoryPointGameStateValidator.Check(state)
}

function drawFromBag(state: PromontoryPointGameState) {
    const piece = state.bag.items.pop()
    assertExists(piece, 'The bag must hold a piece')
    state.bag.remaining -= 1
    return piece
}

function firstPlayer(state: PromontoryPointGameState) {
    const [player] = state.players
    assertExists(player, 'The game must have a player')
    return player
}

function revealFirstHand(state: PromontoryPointGameState, placementsMade = 0, placementsLeft = 3) {
    const player = firstPlayer(state)
    state.turn = { pieces: player.hand, tradesUsed: 0, placementsMade, placementsLeft }
    player.hand = []
    player.handCount = 0
}

describe('Promontory Point canonical validator', () => {
    it('accepts the state a game starts in', () => {
        expect(PromontoryPointGameStateValidator.Check(startGame().state)).toBe(true)
        expect(PromontoryPointRuntime.canonicalStateValidator.Check(startGame().state)).toBe(true)
    })

    it('R-1.1: accepts a piece moved from the bag to the board, a turn, a kept piece or the scrapped count', () => {
        expect(
            accepts((state) => {
                state.track[PROMONTORY.spaceId] = drawFromBag(state)
            })
        ).toBe(true)
        expect(accepts((state) => revealFirstHand(state))).toBe(true)
        expect(
            accepts((state) => {
                firstPlayer(state).keptPiece = drawFromBag(state)
            })
        ).toBe(true)
        expect(
            accepts((state) => {
                state.scrapped[drawFromBag(state)] += 1
            })
        ).toBe(true)
    })

    it('R-1.1: refuses a state that breaks piece conservation for a railroad', () => {
        expect(accepts((state) => void drawFromBag(state))).toBe(false)
        expect(
            accepts((state) => {
                state.track[PROMONTORY.spaceId] = 'railroad.cp'
            })
        ).toBe(false)
        expect(
            accepts((state) => {
                state.scrapped['railroad.up'] += 1
            })
        ).toBe(false)
        expect(
            accepts((state) => {
                firstPlayer(state).keptPiece = 'railroad.kp'
            })
        ).toBe(false)
        expect(
            accepts((state) => {
                const piece = drawFromBag(state)
                state.track[PROMONTORY.spaceId] =
                    piece === 'railroad.sp' ? 'railroad.cp' : 'railroad.sp'
            })
        ).toBe(false)
        expect(
            accepts((state) => {
                state.bag.remaining -= 1
            })
        ).toBe(false)
    })

    it('R-1.1, R-1.3 step 4: refuses holdings beyond the 11 shares of a railroad', () => {
        expect(
            accepts((state) => {
                firstPlayer(state).shares['railroad.cp'] = 11 - (state.players.length - 1)
            })
        ).toBe(true)
        expect(
            accepts((state) => {
                firstPlayer(state).shares['railroad.cp'] = 12 - (state.players.length - 1)
            })
        ).toBe(false)
    })

    it('R-5: refuses a hand count that differs from the hand', () => {
        expect(
            accepts((state) => {
                firstPlayer(state).handCount += 1
            })
        ).toBe(false)
    })

    it('R-2.2 step 3, R-3.3-H1: refuses more than three placements in a turn', () => {
        expect(accepts((state) => revealFirstHand(state, 1, 2))).toBe(true)
        expect(accepts((state) => revealFirstHand(state, 2, 2))).toBe(false)
    })

    it('R-1.2: refuses a price index outside 0 to 29', () => {
        for (const [priceIndex, valid] of [
            [0, true],
            [29, true],
            [-1, false],
            [30, false],
            [9.5, false]
        ] as const) {
            expect(
                accepts((state) => {
                    state.priceIndex['railroad.sp'] = priceIndex
                })
            ).toBe(valid)
        }
    })

    it('R-1.3 step 4: never stores the share decks', () => {
        expect(PromontoryPointGameState.properties).not.toHaveProperty('shareDecks')
        expect(startGame().state).not.toHaveProperty('shareDecks')
    })
})

describe('Promontory Point state round trips', () => {
    it('R-1.1-H2: hydrates and dehydrates canonical state unchanged, money a plain number', () => {
        for (const config of VARIANT_OFF_AND_ON) {
            const { state } = startGame({ config })
            const hydrated = hydrate(state)
            expect(hydrated.dehydrate()).toEqual(state)
            expect(JSON.parse(JSON.stringify(hydrated.dehydrate()))).toEqual(state)
            expect(typeof hydrated.players[0]?.money).toBe('number')
            expect(canonical(hydrated.dehydrate())).toEqual(state)
        }
    })

    it('R-5: hydrates every projected form and dehydrates it unchanged', () => {
        const { game, state } = startGame()
        const perspectives: Visibility.Perspective[] = [
            spectator,
            ...state.players.map((player) => ({
                kind: 'player' as const,
                playerId: player.playerId
            }))
        ]
        for (const perspective of perspectives) {
            const projected = project(state, game, perspective)
            const hydrated = hydrate(projected)
            expect(hydrated.dehydrate()).toEqual(projected)
            expect(hydrated.bag.count()).toBe(state.bag.remaining)
            expect(PromontoryPointGameStateValidator.Check(projected)).toBe(false)
        }
    })
})

describe('Promontory Point projection', () => {
    it('R-5, R-1.3-H1: a player sees their own hand, the other hands redacted with their counts, and every public fact', () => {
        const { game, state } = startGame()
        for (const viewer of state.players) {
            const projected = project(state, game, { kind: 'player', playerId: viewer.playerId })
            for (const [index, player] of projected.players.entries()) {
                const source = state.players[index]
                assertExists(source, 'Projection keeps every player')
                expect(player.handCount).toBe(source.handCount)
                expect(player.money).toBe(source.money)
                expect(player.shares).toEqual(source.shares)
                if (player.playerId === viewer.playerId) {
                    expect(player.hand).toEqual(source.hand)
                } else {
                    expect(player).not.toHaveProperty('hand')
                }
            }
            const owner = hydrate(projected).getPlayerState(viewer.playerId)
            expect(owner.knownHand()).toEqual(viewer.hand)
        }
    })

    it('R-5: a spectator sees no hand, only the counts', () => {
        const { game, state } = startGame()
        const projected = project(state, game, spectator)
        for (const player of projected.players) {
            expect(player).not.toHaveProperty('hand')
            expect(player.handCount).toBe(3)
        }
        expect(() => hydrate(projected).players[0]?.knownHand()).toThrow()
    })

    it('R-5: every perspective sees the bag empty with its count, and no master seed or protected cursor', () => {
        const { game, state } = startGame()
        expect(state.masterSeed).toBeDefined()
        for (const perspective of [
            spectator,
            { kind: 'player', playerId: 'p1' } as const,
            { kind: 'player', playerId: 'p2' } as const
        ]) {
            const projected = project(state, game, perspective)
            expect(projected.bag.items).toEqual([])
            expect(projected.bag.remaining).toBe(state.bag.remaining)
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(projected.protectedPrng).not.toEqual(state.protectedPrng)
            expect(projected.prng).toEqual(state.prng)
        }
    })

    it('R-5, R-6.3-H2: the board, prices, turn, kept pieces and a pending Repairs stay public', () => {
        const { game, state } = startGame({ config: { fourPieceVariant: true } })
        const [placing, other] = state.players
        assertExists(placing, 'The game must have a placing player')
        assertExists(other, 'The game must have another player')
        const kept = placing.hand.pop()
        assertExists(kept, 'The hand must hold a piece')
        placing.keptPiece = kept
        placing.handCount = placing.hand.length
        state.track[PROMONTORY.spaceId] = drawFromBag(state)
        state.priceIndex['railroad.kp'] = 14
        state.turn = { pieces: [], tradesUsed: 1, placementsMade: 1, placementsLeft: 2 }
        state.pendingRepairs = {
            railroadId: 'railroad.kp',
            debtors: [{ playerId: other.playerId, owed: 4 }]
        }
        canonical(state)

        for (const perspective of [
            spectator,
            { kind: 'player', playerId: other.playerId } as const
        ]) {
            const projected = project(state, game, perspective)
            expect(projected.players[0]?.keptPiece).toBe(kept)
            expect(projected.towns).toEqual(state.towns)
            expect(projected.track).toEqual(state.track)
            expect(projected.priceIndex).toEqual(state.priceIndex)
            expect(projected.scrapped).toEqual(state.scrapped)
            expect(projected.turn).toEqual(state.turn)
            expect(projected.pendingRepairs).toEqual(state.pendingRepairs)
            expect(projected.promontoryPointRevision).toBe(1)
            expect(hydrate(projected).shareDeckCount('railroad.cp')).toBe(11 - state.players.length)
        }
    })
})
