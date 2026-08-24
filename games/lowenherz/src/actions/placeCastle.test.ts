import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { currentPlacementColor, HydratedPlaceCastle, PlaceCastle } from './placeCastle.js'
import { neighbors } from '../model/board.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(playerIds: string[], overrides: Partial<LowenherzGameState> = {}) {
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow, Color.Purple, Color.Gray][index],
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
        machineState: MachineState.PlacingCastles,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? Color.Gray : undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makePlaceCastle(
    overrides: Partial<PlaceCastle> & Pick<PlaceCastle, 'playerId' | 'castleCol' | 'castleRow' | 'knightCol' | 'knightRow'>
): HydratedPlaceCastle {
    return new HydratedPlaceCastle({
        id: 'a1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceCastle,
        ...overrides
    })
}

describe('HydratedPlaceCastle', () => {
    it('allows the current player in the placement order to place a legal castle+knight', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5,
            castleRow: 5,
            knightCol: 5,
            knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(true)
    })

    it('rejects a placement from a player who is not up next', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p2', // it's p1's turn first
            castleCol: 5,
            castleRow: 5,
            knightCol: 5,
            knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a castle placed on a hill or village square', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[5][5].type = SquareType.Hill
        state.board.squares[5][6].type = SquareType.Village

        const onHill = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })
        const onVillage = makePlaceCastle({
            playerId: 'p1',
            castleCol: 6, castleRow: 5, knightCol: 6, knightRow: 4
        })

        expect(onHill.isValidPlaceCastle(state)).toBe(false)
        expect(onVillage.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a setup knight placed on a wooded square (only allowed in regular play)', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[4][5].type = SquareType.Forest

        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a knight that is not orthogonally adjacent to the new castle', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const diagonal = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 6, knightRow: 4 // diagonal, not orthogonal
        })
        const tooFar = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 3 // 2 away
        })

        expect(diagonal.isValidPlaceCastle(state)).toBe(false)
        expect(tooFar.isValidPlaceCastle(state)).toBe(false)
    })

    it('enforces the 6-space gap rule against the same color only', () => {
        // Single-player turn order so it's always p1's turn regardless of how many
        // castles have already been placed - isolates the gap check from turn order.
        const state = buildState(['p1'])
        // p1 (Pink) already has a castle at (2,2)
        state.board.squares[2][2].castleColor = Color.Pink
        state.board.squares[2][1].knightColor = Color.Pink

        // Too close for p1's own next castle (distance 5 < 6)
        const tooClose = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 7, knightCol: 2, knightRow: 6 // distance = 5
        })
        expect(tooClose.isValidPlaceCastle(state)).toBe(false)

        // Exactly 6 away is legal
        const exactlySix = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 8, knightCol: 2, knightRow: 7 // distance = 6
        })
        expect(exactlySix.isValidPlaceCastle(state)).toBe(true)
    })

    it('applying the action places the castle+knight and decrements the stock for own-color placements', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })

        action.apply(state)

        expect(state.board.squares[5][5].castleColor).toBe(Color.Pink)
        expect(state.board.squares[4][5].knightColor).toBe(Color.Pink)
        expect(state.getPlayerState('p1').knightsInStock).toBe(11)
    })

    it('describeCastleSquareProblem reports the specific rejection reason', () => {
        // p2 is not up next in a fresh 4-player game.
        const freshState = buildState(['p1', 'p2', 'p3', 'p4'])
        expect(HydratedPlaceCastle.describeCastleSquareProblem(freshState, 'p2', 5, 5)).toBe('notYourTurn')

        // Single-player turn order so it's always p1's turn regardless of how many
        // castles are already on the board - isolates the other 3 reasons from the
        // turn-order check, the same way the gap-rule test above does.
        const state = buildState(['p1'])
        state.board.squares[3][3].type = SquareType.Hill
        state.board.squares[4][4].castleColor = Color.Yellow
        // p1 (Pink) already has a castle at (2,2)
        state.board.squares[2][2].castleColor = Color.Pink

        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 3, 3)).toBe('wrongTerrain')
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 4, 4)).toBe('occupied')
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 2, 7)).toBe('tooClose') // distance 5
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 5, 5)).toBeUndefined()
    })

    it('rejects a castle square with nowhere legal to put its knight', () => {
        // A castle comes with a knight beside it, so a plains square ringed by squares that can
        // take no knight is a dead end. It used to pass this check while being absent from
        // legalCastleSquares, which is how a player could select a square the board had greyed
        // out and then be told, on the SECOND click, that the placement was illegal.
        const state = buildState(['p1'])
        // (5,5) stays plains; every square touching it becomes a hill, which takes no knight
        // during setup.
        for (const n of neighbors(5, 5)) {
            state.board.squares[n.row][n.col].type = SquareType.Hill
        }

        expect(state.board.squares[5][5].type).toBe(SquareType.Blank)
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 5, 5)).toBe(
            'noKnightSquare'
        )
        expect(HydratedPlaceCastle.isValidCastleSquare(state, 'p1', 5, 5)).toBe(false)

        // The two answers agreeing IS the fix - legalCastleSquares always excluded this square,
        // while isValidCastleSquare accepted it.
        const legal = HydratedPlaceCastle.legalCastleSquares(state, 'p1')
        expect(legal.some((square) => square.col === 5 && square.row === 5)).toBe(false)

        // And a square with one open neighbour is still fine, so the check is not simply
        // rejecting everything near a hill.
        state.board.squares[neighbors(5, 5)[0].row][neighbors(5, 5)[0].col].type = SquareType.Blank
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 5, 5)).toBeUndefined()
    })

    it('does not decrement any player stock for a neutral-color placement', () => {
        const state = buildState(['p1', 'p2', 'p3'], {
            // Fast-forward: p1, p2, p3 have already placed all 3 of their own castles,
            // so the next placement (index 9) is p1's neutral-color one.
            board: (() => {
                const b = blankBoard()
                // 3 laps x 3 players x (castle+knight) = 9 pairs; 6 columns per lap
                // easily fits in a 15-column row, one lap per row.
                for (let lap = 0; lap < 3; lap++) {
                    let col = 0
                    for (const color of [Color.Pink, Color.Yellow, Color.Purple]) {
                        b.squares[lap][col] = { type: SquareType.Blank, castleColor: color }
                        col += 1
                        b.squares[lap][col] = { type: SquareType.Blank, knightColor: color }
                        col += 1
                    }
                }
                return b
            })()
        })

        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 8, castleRow: 8, knightCol: 8, knightRow: 7
        })

        expect(action.isValidPlaceCastle(state)).toBe(true)
        action.apply(state)

        expect(state.board.squares[8][8].castleColor).toBe(Color.Gray) // neutral color
        expect(state.getPlayerState('p1').knightsInStock).toBe(12) // unchanged
    })
})

describe('HydratedPlaceCastle.requiredCastleGap', () => {
    it('keeps the rulebook 6-space gap while any legal square can clear it', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }

        expect(HydratedPlaceCastle.requiredCastleGap(state, Color.Pink)).toBe(6)
    })

    it('relaxes to the best the board offers when nothing can clear 6', () => {
        // Setup has no Pass and no take-backs, so a placement with zero legal squares hangs
        // the game before turn 1 - reachable because 12 castles go down under a hard spacing
        // rule (tightest in the 2-player variant, which places four of each colour). When
        // the strict gap is unsatisfiable the requirement degrades to the widest gap still
        // available, which keeps castles as spread out as the board permits.
        const state = buildState(['p1', 'p2'])
        // Hills can't take a castle, so fencing the board off with them leaves only a small
        // blank pocket beside Pink's existing castle - every candidate is 1-2 away.
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                state.board.squares[row][col] = { type: SquareType.Hill }
            }
        }
        state.board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        state.board.squares[0][1] = { type: SquareType.Blank } // (1,0) - gap 1
        state.board.squares[0][2] = { type: SquareType.Blank } // (2,0) - gap 2, needs a knight square
        state.board.squares[1][2] = { type: SquareType.Blank } // (2,1) - knight square for (2,0)
        // Two castles on the board puts the placement plan back on p1 (Pink) - one apiece,
        // and the 2-player plan alternates - so the relaxation is exercised for a colour
        // that already HAS a castle. Yellow's sits far away and blocks nothing.
        state.board.squares[9][14] = { type: SquareType.Blank, castleColor: Color.Yellow }

        // Widest available is (2,1) at manhattan distance 3 - it's a candidate in its own
        // right, with (2,0) serving as its knight square - so 3 becomes the requirement...
        expect(HydratedPlaceCastle.requiredCastleGap(state, Color.Pink)).toBe(3)
        // ...which means the game can still proceed: there IS a legal square.
        expect(HydratedPlaceCastle.legalCastleSquares(state, 'p1').length).toBeGreaterThan(0)
    })
})

describe('currentPlacementColor', () => {
    // What the client previews as the piece about to be placed. It has to follow the
    // PLAN's color, not the placing player's own, or the ghost castles change color from
    // seat to seat during the neutral laps when every one of them will be neutral.
    it('runs own-color laps then neutral laps, for 2 players', () => {
        const state = buildState(['p1', 'p2'])
        const board = state.board

        // 2p plan: 4 own-color laps (p1, p2 each lap), then 2 neutral laps.
        const expected = [
            Color.Pink, Color.Yellow,
            Color.Pink, Color.Yellow,
            Color.Pink, Color.Yellow,
            Color.Pink, Color.Yellow,
            Color.Gray, Color.Gray,
            Color.Gray, Color.Gray
        ]

        for (const [index, color] of expected.entries()) {
            expect(currentPlacementColor(state)).toBe(color)
            // Stand in for a completed placement - the plan is driven purely by how many
            // castles are on the board.
            board.squares[Math.floor(index / BOARD_COLS)][index % BOARD_COLS] = {
                type: SquareType.Blank,
                castleColor: color
            }
        }

        // 12 placements is the whole plan - nothing left to preview.
        expect(currentPlacementColor(state)).toBeUndefined()
    })

    it('is the neutral color for the single closing lap, for 3 players', () => {
        const state = buildState(['p1', 'p2', 'p3'])
        const board = state.board
        for (let index = 0; index < 9; index++) {
            board.squares[Math.floor(index / BOARD_COLS)][index % BOARD_COLS] = {
                type: SquareType.Blank,
                castleColor: Color.Pink
            }
        }
        // 9 own-color placements done, so the 3 neutral ones are next.
        expect(currentPlacementColor(state)).toBe(Color.Gray)
    })

    it('is always the placing player\'s own color at 4 players, which has no neutral lap', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        expect(currentPlacementColor(state)).toBe(Color.Pink)
    })
})
