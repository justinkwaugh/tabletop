import { Visibility, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EndTurn } from '../actions/endTurn.js'
import { PROMONTORY } from '../components/board.js'
import type { PromontoryPointGameState, PromontoryPointProjectedState } from '../model/gameState.js'
import { play } from '../testing/play.js'
import { canonical, startGame } from '../testing/startGame.js'
import { withPlacingEnded } from '../testing/turnPieces.js'
import { atTurnStart, edited, playerOf, turnPlayer } from '../testing/turns.js'
import { PromontoryPointRuntime } from './runtime.js'
import { MachineState } from './states.js'

const spectator = { kind: 'spectator' } as const

function seat(playerId: string) {
    return { kind: 'player', playerId } as const
}

function perspectivesOf(state: PromontoryPointGameState): Visibility.Perspective[] {
    return [spectator, ...state.players.map((player) => seat(player.playerId))]
}

function project(
    state: PromontoryPointGameState,
    game: Game,
    perspective: Visibility.Perspective
): PromontoryPointProjectedState {
    return PromontoryPointRuntime.visibility.state.project(state, perspective, {
        config: game.config
    })
}

function hydrate(state: PromontoryPointProjectedState) {
    return PromontoryPointRuntime.hydrator.hydrateState(structuredClone(state))
}

function isOwner(perspective: Visibility.Perspective, playerId: string): boolean {
    return perspective.kind === 'player' && perspective.playerId === playerId
}

// R-5: every hand concealed, as each seat holds its pieces between turns.
function concealedStart(options: Parameters<typeof startGame>[0] = {}) {
    const { game, state } = startGame(options)
    return { game, state: atTurnStart(state) }
}

function drawFromBag(state: PromontoryPointGameState) {
    const piece = state.bag.items.pop()
    assertExists(piece, 'The bag must hold a piece')
    state.bag.remaining -= 1
    return piece
}

// R-6.3: the variant's turn with three pieces placed and one left over to keep or return.
function withOneLeftOver(state: PromontoryPointGameState): PromontoryPointGameState {
    return edited(state, (draft) => {
        const turn = draft.turn
        assertExists(turn, 'A turn is under way')
        const [leftover, ...placed] = turn.pieces
        assertExists(leftover, 'The turn has pieces')
        for (const railroadId of placed) {
            draft.scrapped[railroadId] += 1
        }
        turn.pieces = [leftover]
        turn.placementsLeft = 0
        draft.machineState = MachineState.TradingAfterPlacing
    })
}

describe('Promontory Point visibility', () => {
    it('R-5: registers the state and action projectors over the canonical schema', () => {
        const { game } = startGame()
        expect(game.protectedInformation).toBe(true)
        expect(Visibility.getGameVisibility(game, PromontoryPointRuntime)).toBe(
            PromontoryPointRuntime.visibility
        )
    })

    it('R-5: each concealed hand is projected for its owner alone; another player and a spectator see only its count', () => {
        const { game, state } = concealedStart()
        for (const perspective of perspectivesOf(state)) {
            const projected = project(state, game, perspective)
            for (const [index, player] of projected.players.entries()) {
                const source = state.players[index]
                assertExists(source, 'Projection keeps every player')
                expect(player.handCount).toBe(source.handCount)
                expect(player.handCount).toBe(3)
                if (isOwner(perspective, player.playerId)) {
                    expect(player.hand).toEqual(source.hand)
                    expect(hydrate(projected).getPlayerState(player.playerId).knownHand()).toEqual(
                        source.hand
                    )
                } else {
                    expect(player).not.toHaveProperty('hand')
                    expect(() =>
                        hydrate(projected).getPlayerState(player.playerId).knownHand()
                    ).toThrow()
                }
            }
        }
    })

    it("R-5: the bag's items, the master seed and the protected cursor are omitted for every seat and the spectator, the bag's count kept", () => {
        const { game, state } = startGame()
        expect(state.masterSeed).toBeDefined()
        for (const perspective of perspectivesOf(state)) {
            const projected = project(state, game, perspective)
            expect(projected.bag.items).toEqual([])
            expect(projected.bag.remaining).toBe(state.bag.remaining)
            expect(projected).not.toHaveProperty('masterSeed')
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(projected.protectedPrng).not.toEqual(state.protectedPrng)
            expect(projected.prng).toEqual(state.prng)
            expect(hydrate(projected).dehydrate()).toEqual(projected)
        }
    })

    it('R-5, R-1.3-H1, R-6.3-H2: money, shares, the board, prices, the turn, kept pieces and a pending Repairs stay public', () => {
        const { game, state } = concealedStart({ config: { fourPieceVariant: true } })
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

        for (const perspective of [spectator, seat(other.playerId)]) {
            const projected = project(state, game, perspective)
            expect(projected.players.map(({ money }) => money)).toEqual(
                state.players.map(({ money }) => money)
            )
            expect(projected.players.map(({ shares }) => shares)).toEqual(
                state.players.map(({ shares }) => shares)
            )
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

    it('R-2.2 step 4, R-2.2 step 1, R-5: the drawn hand is seen by its drawer alone, and at RevealHand the next hand moves into the public turn pieces', () => {
        const { game, state } = startGame()
        const ending = withPlacingEnded(state)
        const drawer = turnPlayer(ending)
        const ended = play(game, ending, EndTurn, { playerId: drawer })
        const [endTurn, revealHand] = ended.processedActions
        const [afterEndTurn, afterReveal] = ended.states
        assertExists(revealHand?.playerId, 'The next turn opens with its RevealHand')
        assertExists(afterEndTurn, 'EndTurn leaves a state')
        assertExists(afterReveal, 'RevealHand leaves a state')
        expect(endTurn?.playerId).toBe(drawer)
        const revealer = revealHand.playerId
        const concealed = playerOf(ending, revealer).hand
        expect(concealed).toHaveLength(3)
        const drawn = playerOf(afterEndTurn, drawer).hand
        expect(drawn).toHaveLength(3)

        for (const perspective of perspectivesOf(state)) {
            const before = project(ending, game, perspective)
            const between = project(afterEndTurn, game, perspective)
            const after = project(afterReveal, game, perspective)

            expect(playerOf(between, drawer).handCount).toBe(3)
            expect(playerOf(between, drawer).hand).toEqual(
                isOwner(perspective, drawer) ? drawn : undefined
            )
            expect(playerOf(before, revealer).hand).toEqual(
                isOwner(perspective, revealer) ? concealed : undefined
            )
            expect(after.turn?.pieces).toEqual(concealed)
            expect(playerOf(after, revealer).handCount).toBe(0)
            expect(playerOf(after, revealer).hand).toEqual(
                isOwner(perspective, revealer) ? [] : undefined
            )
            for (const projected of [before, between, after]) {
                expect(hydrate(projected).dehydrate()).toEqual(projected)
            }
        }
    })

    it('R-6.3-H2: a piece kept at the end of a variant turn stays face up for every seat and the spectator', () => {
        const { game, state } = startGame({ config: { fourPieceVariant: true } })
        const ending = withOneLeftOver(state)
        const keeper = turnPlayer(ending)
        const leftover = ending.turn?.pieces[0]
        assertExists(leftover, 'One piece is left over')

        const { state: next } = play(game, ending, EndTurn, {
            playerId: keeper,
            returnKeptPiece: false
        })

        expect(playerOf(next, keeper).keptPiece).toBe(leftover)
        for (const perspective of perspectivesOf(state)) {
            expect(playerOf(project(next, game, perspective), keeper).keptPiece).toBe(leftover)
        }
    })
})
