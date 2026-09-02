import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import {
    HydratedLowenherzGameState,
    LEGACY_CASTLE_MIN_DISTANCE,
    LowenherzGameState,
    RULEBOOK_CASTLE_MIN_DISTANCE
} from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { currentPlacementOwner, HydratedPlaceCastle, PlaceCastle } from './placeCastle.js'
import { NEUTRAL_OWNER } from '../model/owner.js'
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
        minimumCastleDistance: RULEBOOK_CASTLE_MIN_DISTANCE,
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

    it('requires six empty spaces between castles of the same owner', () => {
        // Single-player turn order so it's always p1's turn regardless of how many
        // castles have already been placed - isolates the gap check from turn order.
        const state = buildState(['p1'])
        // p1 already has a castle at (2,2)
        state.board.squares[2][2].castleOwner = 'p1'
        state.board.squares[2][1].knightOwner = 'p1'

        // Four empty squares between (distance 5)
        const fourBetween = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 7, knightCol: 2, knightRow: 6
        })
        expect(fourBetween.isValidPlaceCastle(state)).toBe(false)

        // Five empty squares between (distance 6) - the pre-correction reading of the rule
        const fiveBetween = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 8, knightCol: 2, knightRow: 7
        })
        expect(fiveBetween.isValidPlaceCastle(state)).toBe(false)

        // Six empty squares between (distance 7) is legal
        const sixBetween = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 9, knightCol: 2, knightRow: 8
        })
        expect(sixBetween.isValidPlaceCastle(state)).toBe(true)
    })

    it('keeps the legacy distance for games recorded before the rule was corrected', () => {
        // A state without minimumCastleDistance predates the correction: its castles were
        // placed at distance 6, and replaying those actions must still succeed.
        const state = buildState(['p1'], { minimumCastleDistance: undefined })
        state.board.squares[2][2].castleOwner = 'p1'
        state.board.squares[2][1].knightOwner = 'p1'

        expect(state.requiredCastleDistance).toBe(LEGACY_CASTLE_MIN_DISTANCE)

        const fiveBetween = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 8, knightCol: 2, knightRow: 7
        })
        expect(fiveBetween.isValidPlaceCastle(state)).toBe(true)
    })

    it('applying the action places the castle+knight and decrements the stock for own placements', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })

        action.apply(state)

        expect(state.board.squares[5][5].castleOwner).toBe('p1')
        expect(state.board.squares[4][5].knightOwner).toBe('p1')
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
        state.board.squares[4][4].castleOwner = 'p2'
        // p1 already has a castle at (2,2)
        state.board.squares[2][2].castleOwner = 'p1'

        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 3, 3)).toBe('wrongTerrain')
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 4, 4)).toBe('occupied')
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 2, 7)).toBe('tooClose') // distance 5
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 2, 8)).toBe('tooClose') // distance 6
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 2, 9)).toBeUndefined() // distance 7
        expect(HydratedPlaceCastle.describeCastleSquareProblem(state, 'p1', 6, 6)).toBeUndefined() // distance 8
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
            // so the next placement (index 9) is p1's neutral one.
            board: (() => {
                const b = blankBoard()
                // 3 laps x 3 players x (castle+knight) = 9 pairs; 6 columns per lap
                // easily fits in a 15-column row, one lap per row.
                for (let lap = 0; lap < 3; lap++) {
                    let col = 0
                    for (const owner of ['p1', 'p2', 'p3']) {
                        b.squares[lap][col] = { type: SquareType.Blank, castleOwner: owner }
                        col += 1
                        b.squares[lap][col] = { type: SquareType.Blank, knightOwner: owner }
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

        expect(state.board.squares[8][8].castleOwner).toBe(NEUTRAL_OWNER)
        expect(state.getPlayerState('p1').knightsInStock).toBe(12) // unchanged
    })
})

describe('HydratedPlaceCastle.requiredCastleGap', () => {
    it('keeps the rulebook distance while any legal square can clear it', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' }

        expect(HydratedPlaceCastle.requiredCastleGap(state, 'p1')).toBe(RULEBOOK_CASTLE_MIN_DISTANCE)
    })

    it('relaxes to the best the board offers when nothing can clear the rulebook distance', () => {
        // Setup has no Pass and no take-backs, so a placement with zero legal squares hangs
        // the game before turn 1 - reachable because 12 castles go down under a hard spacing
        // rule (tightest in the 2-player variant, which places four of each colour). When
        // the strict gap is unsatisfiable the requirement degrades to the widest gap still
        // available, which keeps castles as spread out as the board permits.
        const state = buildState(['p1', 'p2'])
        // Hills can't take a castle, so fencing the board off with them leaves only a small
        // blank pocket beside p1's existing castle - every candidate is 1-2 away.
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                state.board.squares[row][col] = { type: SquareType.Hill }
            }
        }
        state.board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' }
        state.board.squares[0][1] = { type: SquareType.Blank } // (1,0) - gap 1
        state.board.squares[0][2] = { type: SquareType.Blank } // (2,0) - gap 2, needs a knight square
        state.board.squares[1][2] = { type: SquareType.Blank } // (2,1) - knight square for (2,0)
        // Two castles on the board puts the placement plan back on p1 - one apiece, and the
        // 2-player plan alternates - so the relaxation is exercised for an owner that
        // already HAS a castle. p2's sits far away and blocks nothing.
        state.board.squares[9][14] = { type: SquareType.Blank, castleOwner: 'p2' }

        // Widest available is (2,1) at manhattan distance 3 - it's a candidate in its own
        // right, with (2,0) serving as its knight square - so 3 becomes the requirement...
        expect(HydratedPlaceCastle.requiredCastleGap(state, 'p1')).toBe(3)
        // ...which means the game can still proceed: there IS a legal square.
        expect(HydratedPlaceCastle.legalCastleSquares(state, 'p1').length).toBeGreaterThan(0)
    })
})

describe('currentPlacementOwner', () => {
    // What the client previews as the piece about to be placed. It has to follow the
    // PLAN's owner, not the placing player's own, or the ghost castles change color from
    // seat to seat during the neutral laps when every one of them will be neutral.
    it('runs own laps then neutral laps, for 2 players', () => {
        const state = buildState(['p1', 'p2'])
        const board = state.board

        // 2p plan: 4 own laps (p1, p2 each lap), then 2 neutral laps.
        const expected = [
            'p1', 'p2',
            'p1', 'p2',
            'p1', 'p2',
            'p1', 'p2',
            NEUTRAL_OWNER, NEUTRAL_OWNER,
            NEUTRAL_OWNER, NEUTRAL_OWNER
        ]

        for (const [index, owner] of expected.entries()) {
            expect(currentPlacementOwner(state)).toBe(owner)
            // Stand in for a completed placement - the plan is driven purely by how many
            // castles are on the board.
            board.squares[Math.floor(index / BOARD_COLS)][index % BOARD_COLS] = {
                type: SquareType.Blank,
                castleOwner: owner
            }
        }

        // 12 placements is the whole plan - nothing left to preview.
        expect(currentPlacementOwner(state)).toBeUndefined()
    })

    it('is the neutral prince for the single closing lap, for 3 players', () => {
        const state = buildState(['p1', 'p2', 'p3'])
        const board = state.board
        for (let index = 0; index < 9; index++) {
            board.squares[Math.floor(index / BOARD_COLS)][index % BOARD_COLS] = {
                type: SquareType.Blank,
                castleOwner: 'p1'
            }
        }
        // 9 own placements done, so the 3 neutral ones are next.
        expect(currentPlacementOwner(state)).toBe(NEUTRAL_OWNER)
    })

    it('is always the placing player themselves at 4 players, which has no neutral lap', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        expect(currentPlacementOwner(state)).toBe('p1')
    })
})
