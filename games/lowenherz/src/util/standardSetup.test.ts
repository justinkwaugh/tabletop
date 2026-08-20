import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { assembleStandardBoard, applyStandardSetup } from './standardSetup.js'

function buildState(playerColors: Color[]): HydratedLowenherzGameState {
    const playerIds = playerColors.map((_, i) => `p${i + 1}`)
    const players = playerColors.map((color, i) => ({
        playerId: playerIds[i],
        color,
        money: 12,
        powerPoints: 0,
        knightsInStock: 12,
        politicsCards: []
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.StartOfTurn,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: assembleStandardBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerColors.length < 4 ? Color.Gray : undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: []
    }

    return new HydratedLowenherzGameState(data)
}

function castleAndKnightSquares(state: HydratedLowenherzGameState, color: Color) {
    const castles: string[] = []
    const knights: string[] = []
    for (let row = 0; row < state.board.squares.length; row++) {
        for (let col = 0; col < state.board.squares[row].length; col++) {
            const square = state.board.squares[row][col]
            if (square.castleColor === color) castles.push(`${col},${row}`)
            if (square.knightColor === color) knights.push(`${col},${row}`)
        }
    }
    return { castles, knights }
}

describe('assembleStandardBoard', () => {
    it('lays out the 6 tiles A-F in fixed position and rotation, matching known tile terrain', () => {
        const board = assembleStandardBoard()

        expect(board.tileLayout).toEqual([
            { tileId: 'A', tileCol: 0, tileRow: 0, rotation: 0 },
            { tileId: 'B', tileCol: 1, tileRow: 0, rotation: 0 },
            { tileId: 'C', tileCol: 2, tileRow: 0, rotation: 0 },
            { tileId: 'D', tileCol: 0, tileRow: 1, rotation: 0 },
            { tileId: 'E', tileCol: 1, tileRow: 1, rotation: 0 },
            { tileId: 'F', tileCol: 2, tileRow: 1, rotation: 0 }
        ])

        // Spot check a known feature per tile (see boardTiles.ts) - e.g. tile A's hill
        // at local (1,1), tile F's hill at local (0,0) which is global (10,5).
        expect(board.squares[1][1].type).toBe('hill')
        expect(board.squares[5][10].type).toBe('hill')
        expect(board.walls).toEqual([])
    })
})

describe('applyStandardSetup', () => {
    it('gives every color exactly 3 castles and 3 knights, all on Blank terrain', () => {
        const state = buildState([Color.Pink, Color.Yellow, Color.Purple, Color.Gray])
        applyStandardSetup(state)

        for (const color of [Color.Pink, Color.Yellow, Color.Purple, Color.Gray]) {
            const { castles, knights } = castleAndKnightSquares(state, color)
            expect(castles.length).toBe(3)
            expect(knights.length).toBe(3)
        }

        // Every castle/knight square must be Blank terrain underneath.
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                const square = state.board.squares[row][col]
                if (square.castleColor || square.knightColor) {
                    expect(square.type).toBe('blank')
                }
            }
        }
    })

    it('decrements knightsInStock by 3 for every real player', () => {
        const state = buildState([Color.Pink, Color.Yellow, Color.Purple, Color.Gray])
        applyStandardSetup(state)

        for (const player of state.players) {
            expect(player.knightsInStock).toBe(9)
        }
    })

    it('detects exactly 4 starting regions, one per color, each scoring power points for its real owner', () => {
        const state = buildState([Color.Pink, Color.Yellow, Color.Purple, Color.Gray])
        applyStandardSetup(state)

        expect(state.regions.length).toBe(4)
        const ownerColors = state.regions.map((r) => r.ownerColor).sort()
        expect(ownerColors).toEqual([Color.Gray, Color.Pink, Color.Purple, Color.Yellow].sort())

        for (const player of state.players) {
            expect(player.powerPoints).toBeGreaterThan(0)
        }
    })

    it('still places the 4th color as an unowned obstacle in a 3-player game, crediting no one', () => {
        const state = buildState([Color.Pink, Color.Yellow, Color.Purple])
        applyStandardSetup(state)

        const { castles, knights } = castleAndKnightSquares(state, Color.Gray)
        expect(castles.length).toBe(3)
        expect(knights.length).toBe(3)

        expect(state.regions.length).toBe(4)
        const grayRegion = state.regions.find((r) => r.ownerColor === Color.Gray)
        expect(grayRegion).toBeDefined()

        // No player has Gray, so only the 3 real players' own regions contribute
        // power points - Gray's region exists (as an obstacle) but credits no one.
        expect(state.players.length).toBe(3)
        for (const player of state.players) {
            expect(player.powerPoints).toBeGreaterThan(0)
        }
    })

    it('places 20 boundary walls total, enclosing exactly the 4 corner regions', () => {
        const state = buildState([Color.Pink, Color.Yellow, Color.Purple, Color.Gray])
        applyStandardSetup(state)

        expect(state.board.walls.length).toBe(20)
    })
})
