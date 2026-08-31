import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { detectNewRegions, repairDuplicateRegionIds } from './regionDetection.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, LowenherzBoard, SquareType, WallEdge } from '../model/board.js'
import { Region } from '../model/region.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'

function blankBoard(): LowenherzBoard {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
        ),
        walls: []
    }
}

function withCastle(board: LowenherzBoard, col: number, row: number, owner: string): LowenherzBoard {
    board.squares[row][col] = { ...board.squares[row][col], castleOwner: owner }
    return board
}

// A minimal mid-game state, purely as a vehicle for hydrating a given regions array.
function buildStateWithRegions(regions: Region[]): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    return new HydratedLowenherzGameState({
        id: 'game-1',
        gameId: 'game-1',
        players: playerIds.map((playerId, index) => ({
            playerId,
            color: [Color.Pink, Color.Yellow][index],
            money: 12,
            powerPoints: 0,
            knightsInStock: 12,
            politicsCards: []
        })),
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.PlacingKnights,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions,
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: []
    })
}

describe('detectNewRegions', () => {
    it('detects a single newly-sealed region containing one castle', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, 'p1')
        // Elsewhere on the board, 2 other castles keep the huge open remainder from
        // also qualifying as a (single-castle) region.
        withCastle(board, 10, 5, 'p2')
        withCastle(board, 12, 5, 'p3')

        // Enclose a 2x2 pocket around Pink's castle at the top-left corner (board
        // edges provide the north/west walls for free).
        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West }, // east side of the pocket, row 0
            { col: 2, row: 1, edge: WallEdge.West }, // east side of the pocket, row 1
            { col: 0, row: 2, edge: WallEdge.North }, // south side of the pocket, col 0
            { col: 1, row: 2, edge: WallEdge.North } // south side of the pocket, col 1
        ]

        const newRegions = detectNewRegions(board, [])
        const pinkRegion = newRegions.find((r) => r.owner === 'p1')

        expect(pinkRegion).toBeDefined()
        expect(new Set(pinkRegion!.squareKeys)).toEqual(new Set(['0,0', '1,0', '0,1', '1,1']))
        expect(pinkRegion!.castleSquareKey).toBe('0,0')
    })

    it('one wall can seal two regions at once, matching the rulebook example', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, 'p1')
        withCastle(board, 1, 0, 'p2')

        // Everything is walled off except the shared edge between the two castles.
        board.walls = [
            { col: 0, row: 1, edge: WallEdge.North }, // south of (0,0)
            { col: 1, row: 1, edge: WallEdge.North }, // south of (1,0)
            { col: 2, row: 0, edge: WallEdge.West } // east of (1,0)
        ]

        // Placing the last wall between the two castles seals both at once.
        board.walls.push({ col: 1, row: 0, edge: WallEdge.West })

        const newRegions = detectNewRegions(board, [])
        const pinkRegion = newRegions.find((r) => r.owner === 'p1')
        const yellowRegion = newRegions.find((r) => r.owner === 'p2')

        expect(pinkRegion?.squareKeys).toEqual(['0,0'])
        expect(yellowRegion?.squareKeys).toEqual(['1,0'])
    })

    it('creates an owner-less neutral zone when a sealed pocket has no castle', () => {
        const board = blankBoard()
        withCastle(board, 10, 5, 'p2')
        withCastle(board, 12, 5, 'p3')

        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const newRegions = detectNewRegions(board, [])
        const neutralZone = newRegions.find(
            (r) => new Set(r.squareKeys).size === 4 && [...r.squareKeys].every((k) => ['0,0', '1,0', '0,1', '1,1'].includes(k))
        )

        expect(neutralZone).toBeDefined()
        expect(neutralZone!.owner).toBeUndefined()
        expect(neutralZone!.castleSquareKey).toBeUndefined()
    })

    it('does not create a region for a pocket enclosing 2+ different castles', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, 'p1')
        withCastle(board, 1, 0, 'p2')

        // Same pocket as the "single region" test, but no wall between the two
        // castles - they're both stuck in one shared, contested pocket.
        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const newRegions = detectNewRegions(board, [])
        const contestedPocket = newRegions.find((r) => r.squareKeys.includes('0,0') && r.squareKeys.includes('1,0'))

        expect(contestedPocket).toBeUndefined()
    })

    it('does not re-report a region that is already tracked', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, 'p1')
        withCastle(board, 10, 5, 'p2')
        withCastle(board, 12, 5, 'p3')

        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]

        const firstPass = detectNewRegions(board, [])
        const pinkRegion = firstPass.find((r) => r.owner === 'p1')!

        const existingRegions: Region[] = [pinkRegion]
        const secondPass = detectNewRegions(board, existingRegions)

        expect(secondPass.some((r) => r.owner === 'p1')).toBe(false)
    })

    it('never reuses an id already held by an existing region', () => {
        const board = blankBoard()
        withCastle(board, 0, 0, 'p1')
        withCastle(board, 10, 5, 'p2')
        withCastle(board, 12, 5, 'p3')

        // Seal Pink's top-left pocket first, exactly as a wall placement would.
        board.walls = [
            { col: 2, row: 0, edge: WallEdge.West },
            { col: 2, row: 1, edge: WallEdge.West },
            { col: 0, row: 2, edge: WallEdge.North },
            { col: 1, row: 2, edge: WallEdge.North }
        ]
        const tracked = detectNewRegions(board, [])
        expect(tracked.length).toBeGreaterThan(0)

        // Then seal a second, separate pocket for Pink in the bottom-left corner - a
        // later detection pass, with the first region already tracked.
        withCastle(board, 0, BOARD_ROWS - 1, 'p1')
        board.walls.push(
            { col: 2, row: BOARD_ROWS - 1, edge: WallEdge.West },
            { col: 0, row: BOARD_ROWS - 1, edge: WallEdge.North },
            { col: 1, row: BOARD_ROWS - 1, edge: WallEdge.North },
            { col: 1, row: BOARD_ROWS - 1, edge: WallEdge.West }
        )
        const secondPass = detectNewRegions(board, tracked)

        // Ids identify regions everywhere else in the game (alliances, an in-progress
        // expansion, every UI lookup), so a second pass minting "region-0" again would
        // leave two live regions indistinguishable - and find(by id) silently resolving
        // to whichever happened to come first.
        const allIds = [...tracked, ...secondPass].map((r) => r.id)
        expect(new Set(allIds).size).toBe(allIds.length)
    })
})

describe('repairDuplicateRegionIds', () => {
    function region(id: string, squareKeys: string[], owner?: string): Region {
        return { id, owner, squareKeys, castleSquareKey: squareKeys[0] }
    }

    it('leaves already-unique ids completely alone', () => {
        const regions = [region('region-0', ['0,0']), region('region-1', ['5,5'])]

        expect(repairDuplicateRegionIds(regions)).toBe(0)
        expect(regions.map((r) => r.id)).toEqual(['region-0', 'region-1'])
    })

    it('re-mints later duplicates, keeping the first occurrence\'s id and skipping ids in use', () => {
        // Exactly the shape a game from before collision-free minting ends up in: the
        // setup pass hands out region-0..2, then a later wall placement restarts at 0.
        const regions = [
            region('region-0', ['0,0'], 'p1'),
            region('region-1', ['0,8'], 'p2'),
            region('region-2', ['14,0'], 'p3'),
            region('region-0', ['6,6'], 'p1'),
            region('region-1', ['9,3'], 'p4')
        ]

        expect(repairDuplicateRegionIds(regions)).toBe(2)
        // The first three keep their ids (everything that references an id already
        // resolved to those), and the two collisions get the lowest unused ids.
        expect(regions.map((r) => r.id)).toEqual([
            'region-0',
            'region-1',
            'region-2',
            'region-3',
            'region-4'
        ])
        // Nothing but the ids changed.
        expect(regions[3].squareKeys).toEqual(['6,6'])
        expect(regions[4].owner).toBe('p4')
    })

    it('runs on hydration, so a stored state with collisions comes back repaired', () => {
        const state = buildStateWithRegions([
            region('region-0', ['0,0'], 'p1'),
            region('region-0', ['6,6'], 'p2')
        ])

        const ids = state.regions.map((r) => r.id)
        expect(new Set(ids).size).toBe(2)
        // Which matters because this is how every ownership check finds a region: with
        // the collision in place, Yellow's region resolved to Pink's.
        expect(state.regions.find((r) => r.id === ids[1])!.owner).toBe('p2')
    })
})
