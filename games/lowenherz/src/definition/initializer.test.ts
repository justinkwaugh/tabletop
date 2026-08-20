import { describe, expect, it } from 'vitest'
import { Game, GameConfig, GameStatus, GameStorage, PlayerStatus } from '@tabletop/common'
import { LowenherzGameInitializer } from './initializer.js'
import { MachineState } from './states.js'
import { CardBack } from './actionCards.js'

function buildGame(playerCount: number, config: GameConfig = {}): Game {
    return {
        id: 'game-1',
        typeId: 'lowenherz',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'p1',
        name: 'Test Game',
        players: Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            isHuman: true,
            name: `Player ${i + 1}`,
            status: PlayerStatus.Joined
        })),
        config,
        hotseat: true,
        createdAt: new Date(),
        winningPlayerIds: [],
        storage: GameStorage.Local
    }
}

describe('LowenherzGameInitializer', () => {
    it('keeps turnOrder stable even after turnManager.turnOrder is rotated in place', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(4)

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        const originalTurnOrder = [...state.turnOrder]
        expect(state.turnOrder.length).toBe(4)

        // Regression check: this is the kind of in-place rotation the generic engine
        // performs on turnManager.turnOrder as part of its own bookkeeping. Our own
        // turnOrder field must not be the same array reference, or it'd get scrambled
        // too - which is exactly the bug that made every 2nd-lap placement fail.
        state.turnManager.newFirstPlayer(state.turnOrder[2])

        expect(state.turnOrder).toEqual(originalTurnOrder)
        expect(state.turnManager.turnOrder).not.toEqual(originalTurnOrder)
    })

    it('deals all 13 politics cards across the two piles with no duplicates, and gives every player an empty hand', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(4)

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        const allCardIds = [...state.politicsCardPileA, ...state.politicsCardPileB].map((c) => c.id)
        expect(allCardIds.length).toBe(13)
        expect(new Set(allCardIds).size).toBe(13)
        expect(state.politicsTakingPlayerId).toBeUndefined()

        for (const player of state.players) {
            expect(player.politicsCards).toEqual([])
        }
    })

    it('defaults to the player-placed-castles flow, with the A-deck stacked on top', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(4)

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        expect(state.machineState).toBe(MachineState.PlacingCastles)
        expect(state.actionDeck.length).toBe(31)
        expect(state.actionDeck.slice(0, 6).every((c) => c.back === CardBack.A)).toBe(true)
        expect(state.board.squares.every((row) => row.every((sq) => !sq.castleColor && !sq.knightColor))).toBe(
            true
        )
        expect(state.regions).toEqual([])
    })

    it('switches to the fixed basic-game setup when playerPlacedCastles is off', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(4, { playerPlacedCastles: false })

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        expect(state.machineState).toBe(MachineState.StartOfTurn)
        // Basic-game deck: no A cards, 25 total (see actionDeckAssembly.ts).
        expect(state.actionDeck.length).toBe(25)
        expect(state.actionDeck.every((c) => c.back !== CardBack.A)).toBe(true)
        // Every player already has a scored starting region and 9 knights left in
        // stock (12 - 3 placed), without anyone ever submitting a PlaceCastle action.
        expect(state.regions.length).toBe(4)
        for (const player of state.players) {
            expect(player.knightsInStock).toBe(9)
            expect(player.powerPoints).toBeGreaterThan(0)
        }
    })

    it('ignores playerPlacedCastles=off at 2 players, since that variant IS manual placement', () => {
        const initializer = new LowenherzGameInitializer()
        const game = buildGame(2, { playerPlacedCastles: false })

        const state = initializer.initializeGameState(game, {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        // The 2-player rules build on the variable construction rules (4 castles each
        // plus 2 of a neutral color), so the fixed basic-game layout - a 4-color,
        // one-castle-each diagram with no neutral prince - would discard the variant
        // wholesale. Placement happens regardless of the config option.
        expect(state.machineState).toBe(MachineState.PlacingCastles)
        expect(state.regions).toEqual([])
        expect(state.board.squares.every((row) => row.every((sq) => !sq.castleColor && !sq.knightColor))).toBe(
            true
        )
        // ...and a neutral color exists for the 2 castles each player places in it.
        expect(state.neutralColor).toBeDefined()
        expect(state.players.some((p) => p.color === state.neutralColor)).toBe(false)
        // A-lettered cards are stacked on top, as variable construction requires.
        expect(state.actionDeck[0].back).toBe(CardBack.A)
    })

    it('redistributes the politics piles for exploration, not just shuffles within them', () => {
        // The piles are unordered - a player commits to a pile and takes whichever card in it
        // they like - so shuffling each in place conceals nothing. What has to be randomized is
        // which pile a card is in.
        const initializer = new LowenherzGameInitializer()
        const state = initializer.initializeGameState(buildGame(3), {
            id: 'game-1',
            gameId: 'game-1',
            activePlayerIds: [],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 1, invocations: 0 },
            winningPlayerIds: []
        })

        const startingA = new Set(state.politicsCardPileA.map((card) => card.id))
        const sizeA = state.politicsCardPileA.length
        const sizeB = state.politicsCardPileB.length
        const everyCard = [...state.politicsCardPileA, ...state.politicsCardPileB]
            .map((card) => card.id)
            .sort()

        let anyCardMoved = false
        for (let attempt = 0; attempt < 40; attempt++) {
            const explored = initializer.initializeExplorationState(state.dehydrate())

            // Same cards, same pile sizes - only the split between them may differ.
            expect(explored.politicsCardPileA).toHaveLength(sizeA)
            expect(explored.politicsCardPileB).toHaveLength(sizeB)
            expect(
                [...explored.politicsCardPileA, ...explored.politicsCardPileB]
                    .map((card) => card.id)
                    .sort()
            ).toEqual(everyCard)

            if (explored.politicsCardPileA.some((card) => !startingA.has(card.id))) {
                anyCardMoved = true
            }
        }

        // Forty redeals of a 13-card deck: an in-place shuffle would never move one across.
        expect(anyCardMoved).toBe(true)
    })
})
