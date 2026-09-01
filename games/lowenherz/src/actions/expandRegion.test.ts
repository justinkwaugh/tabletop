import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Region } from '../model/region.js'
import { HydratedExpandRegion } from './expandRegion.js'
import { isWalledBetween } from '../model/board.js'
import { isKnightSafeToRemove } from '../util/knightConnectivity.js'

function blankBoard(): { squares: BoardSquare[][]; walls: { col: number; row: number; edge: WallEdge }[] } {
    const squares = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
    )
    // Castles far from the action so the wide-open remainder always has 2+ distinct
    // castle colors in it (as any real game would) and never gets misidentified by
    // expandRegion's detectNewRegions call as a single-castle-or-fewer region of its
    // own - most tests in this file never bother enclosing their tracked regions'
    // squares with real walls (they only track them via the regions array), so
    // without this, the wide-open "rest of the board" would have zero real castles
    // and get flagged as a bogus giant neutral zone. Same trick as placeWall.test.ts.
    squares[8][12] = { type: SquareType.Blank, castleOwner: 'p1' }
    squares[8][13] = { type: SquareType.Blank, castleOwner: 'p2' }
    return { squares, walls: [] }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 12,
        politicsCards: []
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.PlacingKnights,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [{ id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' }],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        knightsRemaining: 2,
        knightPlacingPlayerId: 'p1',
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeExpandRegion(
    playerId: string,
    regionId: string,
    space: { col: number; row: number }
): HydratedExpandRegion {
    return new HydratedExpandRegion({
        id: `expand-${regionId}-${space.col},${space.row}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.ExpandRegion,
        playerId,
        regionId,
        space
    })
}

describe('HydratedExpandRegion', () => {
    it('expands a genuinely walled-in (completed) region, removing the now-interior wall', () => {
        // Regression: a completed region is ALWAYS fully enclosed by walls (that's how
        // it became a region in the first place) - my initial implementation required
        // the target square to NOT be wall-blocked from the region, which made it
        // impossible to ever expand any real region. Every other test in this file
        // used a region with no actual wall around it, which is why they didn't catch
        // this - a live playtest did.
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' }
        board.walls = [
            { col: 0, row: 1, edge: WallEdge.North }, // south of (0,0)
            { col: 1, row: 0, edge: WallEdge.West } // east of (0,0) - the wall being crossed
        ]
        const state = buildState({
            board,
            regions: [{ id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' }]
        })

        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual(['0,0', '1,0'])
        // The wall between (0,0) and (1,0) is now interior to the region and gets
        // cleaned up (the south wall stays since (0,1) is still outside the region).
        // The region must remain fully enclosed, so (1,0)'s other two open edges -
        // north of (1,1) and west of (2,0) - get brand new walls; only the edge
        // shared with the rest of the region (already handled above) stays open.
        expect(state.board.walls).toEqual(
            expect.arrayContaining([
                { col: 0, row: 1, edge: WallEdge.North },
                { col: 1, row: 1, edge: WallEdge.North },
                { col: 2, row: 0, edge: WallEdge.West }
            ])
        )
        expect(state.board.walls).toHaveLength(3)
    })

    it('detects a collateral region completion elsewhere on the board when the new expansion walls happen to seal it', () => {
        // Regression: the new walls added around an expansion's newly-claimed
        // squares can happen to also complete an UNRELATED enclosure elsewhere on
        // the board (e.g. boxing in a castle+knight pair that was still sitting in
        // open territory) - only placeWall.ts called detectNewRegions, so
        // expandRegion.ts silently missed this and left the newly-boxed-in prince
        // untracked and unscored.
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' }
        board.squares[0][2] = { type: SquareType.Blank, castleOwner: 'p2' }
        board.squares[1][2] = { type: SquareType.Blank, knightOwner: 'p2' }
        // Yellow's pair is already walled on 3 of its 4 exterior edges - only the
        // edge facing pink's about-to-be-claimed territory is still open.
        board.walls = [
            { col: 3, row: 0, edge: WallEdge.West }, // right of (2,0)
            { col: 3, row: 1, edge: WallEdge.West }, // right of (2,1)
            { col: 2, row: 2, edge: WallEdge.North } // below (2,1)
        ]
        const state = buildState({
            board,
            regions: [{ id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' }]
        })

        // Expand pink by 2 chained spaces: (1,0) then (1,1), as two separate actions
        // (see expandRegion.ts) - walling off their exterior edges adds the one
        // missing wall around yellow's pair, sealing it.
        const first = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        expect(first.isValidExpandRegion(state)).toBe(true)
        first.apply(state)
        expect(state.expandingRegionId).toBe('r1')

        const second = makeExpandRegion('p1', 'r1', { col: 1, row: 1 })
        expect(second.isValidExpandRegion(state)).toBe(true)
        second.apply(state)
        expect(state.expandingRegionId).toBeUndefined()

        const p2Region = state.regions.find((r) => r.owner === 'p2')
        expect(p2Region).toBeDefined()
        expect(p2Region!.squareKeys.slice().sort()).toEqual(['2,0', '2,1'])
        expect(state.getPlayerState('p1').powerPoints).toBe(2)
        expect(state.getPlayerState('p2').powerPoints).toBe(3) // region-creation table: 2 spaces
        expect(second.metadata).toEqual({
            townsTaken: 0,
            pointsGained: 1,
            completedRegions: [
                { owner: 'p2', spaceCount: 2, townCount: 0, points: 3, anchorSquareKey: '2,0.5' }
            ]
        })
    })

    it('expands into one open adjacent space, scoring 1 point and spending one sword', () => {
        const state = buildState()
        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })

        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        expect(state.regions[0].squareKeys).toEqual(['0,0', '1,0'])
        expect(state.getPlayerState('p1').powerPoints).toBe(1)
        // One of the two swords, not the whole action - the other is still owed as a
        // knight placement ("place one knight and expand one of his regions").
        expect(state.knightsRemaining).toBe(1)
        // A 2nd space of the SAME region is still allowed (see expandingRegionId), and
        // costs nothing further; a 2nd separate expansion is not (see expansionUsed).
        expect(state.expandingRegionId).toBe('r1')
        expect(state.expansionUsed).toBe(true)
        expect(action.metadata).toEqual({ townsTaken: 0, pointsGained: 1 })
        // The region must stay fully enclosed - (1,0)'s open edges get new walls, but
        // the edge it shares with the rest of the region ((0,0)) stays open.
        expect(state.board.walls).toEqual(
            expect.arrayContaining([
                { col: 1, row: 1, edge: WallEdge.North },
                { col: 2, row: 0, edge: WallEdge.West }
            ])
        )
        expect(state.board.walls).toHaveLength(2)
    })

    it('expands by a 2nd space adjacent to the region as extended by the 1st, ending the expansion', () => {
        const state = buildState()
        // (1,0) is adjacent to the original region (0,0); (2,0) is only adjacent to
        // (1,0), not to the original region - valid because of the chaining rule.
        const first = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        expect(first.isValidExpandRegion(state)).toBe(true)
        first.apply(state)

        const second = makeExpandRegion('p1', 'r1', { col: 2, row: 0 })
        expect(second.isValidExpandRegion(state)).toBe(true)
        second.apply(state)

        expect(state.regions[0].squareKeys).toEqual(['0,0', '1,0', '2,0'])
        expect(state.getPlayerState('p1').powerPoints).toBe(2)
        expect(state.expandingRegionId).toBeUndefined()
        // No wall between the two newly-claimed squares (interior to the region now),
        // nor between (0,0) and (1,0) (the shared edge with the rest of the region) -
        // only the truly exterior edges get walled.
        expect(state.board.walls).toEqual(
            expect.arrayContaining([
                { col: 1, row: 1, edge: WallEdge.North },
                { col: 2, row: 1, edge: WallEdge.North },
                { col: 3, row: 0, edge: WallEdge.West }
            ])
        )
        expect(state.board.walls).toHaveLength(3)
    })

    it('rejects a 2nd space not adjacent to the region as extended by the 1st', () => {
        const state = buildState()
        const first = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        first.apply(state)

        // (5,5) is nowhere near (0,0) or (1,0).
        const second = makeExpandRegion('p1', 'r1', { col: 5, row: 5 })
        expect(second.isValidExpandRegion(state)).toBe(false)
    })

    it('rejects starting a 2nd, different region while one expansion is already in progress', () => {
        const state = buildState({
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' },
                { id: 'r2', owner: 'p1', squareKeys: ['5,5'], castleSquareKey: '5,5' }
            ]
        })
        const first = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        first.apply(state)

        const second = makeExpandRegion('p1', 'r2', { col: 5, row: 4 })
        expect(second.isValidExpandRegion(state)).toBe(false)
        expect(second.invalidExpandRegionReason(state)).toBe(
            "You're already expanding a different region this turn."
        )
    })

    it('allows a 2nd space of the SAME region without spending another sword', () => {
        const state = buildState({ knightsRemaining: 1 })
        const first = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        first.apply(state)
        expect(state.knightsRemaining).toBe(0)

        const second = makeExpandRegion('p1', 'r1', { col: 2, row: 0 })
        expect(second.isValidExpandRegion(state)).toBe(true)
        second.apply(state)
        expect(state.knightsRemaining).toBe(0)
    })

    it('refuses a 2nd, separate expansion even with a sword still unspent', () => {
        const state = buildState({
            knightsRemaining: 2,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' },
                { id: 'r2', owner: 'p1', squareKeys: ['5,5'], castleSquareKey: '5,5' }
            ]
        })
        // A complete 1-space expansion of r1: expand, then stop short of the optional
        // 2nd space (which is what clears expandingRegionId in real play - see
        // placingKnights.ts - so clear it directly here).
        makeExpandRegion('p1', 'r1', { col: 1, row: 0 }).apply(state)
        state.expandingRegionId = undefined

        expect(state.knightsRemaining).toBe(1)
        const second = makeExpandRegion('p1', 'r2', { col: 5, row: 4 })
        expect(second.isValidExpandRegion(state)).toBe(false)
        expect(second.invalidExpandRegionReason(state)).toBe(
            'This action can only expand a region once - place a knight instead.'
        )
    })

    it('awards a +5 bonus for capturing a town', () => {
        const board = blankBoard()
        board.squares[0][1] = { type: SquareType.Village }
        const state = buildState({ board })

        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        action.apply(state)

        expect(state.getPlayerState('p1').powerPoints).toBe(1 + 5)
        expect(action.metadata).toEqual({ townsTaken: 1, pointsGained: 6 })
    })

    it('rejects when it is not the designated player\'s turn', () => {
        const state = buildState()
        expect(makeExpandRegion('p2', 'r1', { col: 1, row: 0 }).isValidExpandRegion(state)).toBe(false)
    })

    it('rejects once knightsRemaining is exhausted', () => {
        const state = buildState({ knightsRemaining: 0 })
        expect(makeExpandRegion('p1', 'r1', { col: 1, row: 0 }).isValidExpandRegion(state)).toBe(false)
    })

    it('rejects a regionId the player does not own', () => {
        const state = buildState({
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
                { id: 'r2', owner: 'p2', squareKeys: ['5,5'] }
            ]
        })
        expect(makeExpandRegion('p1', 'r2', { col: 5, row: 4 }).isValidExpandRegion(state)).toBe(false)
    })

    it('rejects a square already inside the region being expanded', () => {
        const state = buildState()
        expect(makeExpandRegion('p1', 'r1', { col: 0, row: 0 }).isValidExpandRegion(state)).toBe(false)
    })

    it('rejects a space with an opposing knight or castle', () => {
        const board = blankBoard()
        board.squares[0][1] = { type: SquareType.Blank, knightOwner: 'p2' }
        const state = buildState({ board })
        expect(makeExpandRegion('p1', 'r1', { col: 1, row: 0 }).isValidExpandRegion(state)).toBe(false)
    })

    it('allows a space with the player\'s own knight already on it', () => {
        const board = blankBoard()
        board.squares[0][1] = { type: SquareType.Blank, knightOwner: 'p1' }
        const state = buildState({ board })
        expect(makeExpandRegion('p1', 'r1', { col: 1, row: 0 }).isValidExpandRegion(state)).toBe(true)
    })

    it('rejects merging one of the player\'s own other regions', () => {
        const state = buildState({
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
                { id: 'r2', owner: 'p1', squareKeys: ['1,0'] }
            ]
        })
        expect(makeExpandRegion('p1', 'r1', { col: 1, row: 0 }).isValidExpandRegion(state)).toBe(false)
    })

    it('rejects invading another region when the invader\'s knights do not outnumber the defender\'s', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' } // (0,0) - invader has 0 knights
        board.squares[0][2] = { type: SquareType.Blank, castleOwner: 'p2' } // (2,0)
        board.squares[0][3] = { type: SquareType.Blank, knightOwner: 'p2' } // (3,0) - defender has 1 knight
        const state = buildState({
            board,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'], castleSquareKey: '0,0' },
                { id: 'r2', owner: 'p2', squareKeys: ['1,0', '2,0', '3,0'], castleSquareKey: '2,0' }
            ]
        })

        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        expect(action.isValidExpandRegion(state)).toBe(false)
        expect(action.invalidExpandRegionReason(state)).toBe(
            "Your knights in this region must outnumber the target region's knights to invade it."
        )
    })

    it('rejects invading a region that is allied with the invader, even when knights outnumber it', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' } // (0,0)
        board.squares[1][0] = { type: SquareType.Blank, knightOwner: 'p1' } // (0,1)
        board.squares[2][0] = { type: SquareType.Blank, knightOwner: 'p1' } // (0,2) - invader has 2 knights
        board.squares[1][2] = { type: SquareType.Blank, castleOwner: 'p2' } // (2,1)
        board.squares[1][3] = { type: SquareType.Blank, knightOwner: 'p2' } // (3,1) - defender has 1 knight
        const state = buildState({
            board,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0', '0,1', '0,2'], castleSquareKey: '0,0' },
                { id: 'r2', owner: 'p2', squareKeys: ['1,1', '2,1', '3,1'], castleSquareKey: '2,1' }
            ],
            alliances: [{ id: 'alliance-1', regionAId: 'r1', regionBId: 'r2' }]
        })

        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 1 })
        expect(action.isValidExpandRegion(state)).toBe(false)
        expect(action.invalidExpandRegionReason(state)).toBe(
            "An alliance protects that region from expansion - it can't be invaded while allied."
        )
    })

    it('invades another region when the invader\'s knights outnumber the defender\'s, with direct loss/gain', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleOwner: 'p1' } // (0,0)
        board.squares[1][0] = { type: SquareType.Blank, knightOwner: 'p1' } // (0,1)
        board.squares[2][0] = { type: SquareType.Blank, knightOwner: 'p1' } // (0,2) - invader has 2 knights
        board.squares[1][2] = { type: SquareType.Blank, castleOwner: 'p2' } // (2,1)
        board.squares[1][3] = { type: SquareType.Blank, knightOwner: 'p2' } // (3,1) - defender has 1 knight
        const state = buildState({
            board,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0', '0,1', '0,2'], castleSquareKey: '0,0' },
                { id: 'r2', owner: 'p2', squareKeys: ['1,1', '2,1', '3,1'], castleSquareKey: '2,1' }
            ]
        })

        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 1 })
        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual(['0,0', '0,1', '0,2', '1,1'])
        expect(state.regions.find((r) => r.id === 'r2')!.squareKeys).toEqual(['2,1', '3,1'])
        expect(state.getPlayerState('p1').powerPoints).toBe(1)
        expect(state.getPlayerState('p2').powerPoints).toBe(-1)
        expect(action.metadata).toEqual({
            townsTaken: 0,
            pointsGained: 1,
            invasions: [
                {
                    victimOwner: 'p2',
                    directSpacesLost: 1,
                    directPointsLost: 1,
                    directAnchorSquareKey: '1,1',
                    disconnectedSpaces: 0,
                    disconnectedPointsLost: 0
                }
            ]
        })
    })

    it('splits off a disconnected piece of the defender\'s region as a new neutral zone, scored via the region-creation table', () => {
        const board = blankBoard()
        // Invader (Pink): castle at (2,0), knights at (1,0) and (3,0) - 2 knights.
        board.squares[0][1] = { type: SquareType.Blank, knightOwner: 'p1' }
        board.squares[0][2] = { type: SquareType.Blank, castleOwner: 'p1' }
        board.squares[0][3] = { type: SquareType.Blank, knightOwner: 'p1' }
        // Defender (Yellow): a 4-square line - knight(0,1), castle(1,1), connector(2,1),
        // stranded-with-town(3,1) - 1 knight, weaker than the invader.
        board.squares[1][0] = { type: SquareType.Blank, knightOwner: 'p2' }
        board.squares[1][1] = { type: SquareType.Blank, castleOwner: 'p2' }
        board.squares[1][3] = { type: SquareType.Village }
        const state = buildState({
            board,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['1,0', '2,0', '3,0'], castleSquareKey: '2,0' },
                {
                    id: 'r2',
                    owner: 'p2',
                    squareKeys: ['0,1', '1,1', '2,1', '3,1'],
                    castleSquareKey: '1,1'
                }
            ]
        })

        // Taking the connector square (2,1) splits the defender's region: (0,1)/(1,1)
        // stay connected to the castle, but (3,1) is cut off entirely.
        const action = makeExpandRegion('p1', 'r1', { col: 2, row: 1 })
        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual([
            '1,0',
            '2,0',
            '3,0',
            '2,1'
        ])
        expect(state.regions.find((r) => r.id === 'r2')!.squareKeys).toEqual(['0,1', '1,1'])
        const neutralZone = state.regions.find(
            (r) => !r.owner && r.squareKeys.length === 1 && r.squareKeys[0] === '3,1'
        )
        expect(neutralZone).toBeDefined()

        // Invader gains only for the 1 space it directly took (Blank, no town).
        expect(state.getPlayerState('p1').powerPoints).toBe(1)
        // Defender loses 1 point for the directly-taken space, plus the region-creation
        // table value for the 1-space, 1-town stranded piece (3 for 1-4 spaces, +5 for
        // the town) - the invader does not gain any of that second part.
        expect(state.getPlayerState('p2').powerPoints).toBe(-(1 + 3 + 5))
        expect(action.metadata).toEqual({
            townsTaken: 0,
            pointsGained: 1,
            invasions: [
                {
                    victimOwner: 'p2',
                    directSpacesLost: 1,
                    directPointsLost: 1,
                    directAnchorSquareKey: '2,1',
                    disconnectedSpaces: 1,
                    disconnectedPointsLost: 8,
                    disconnectedAnchorSquareKey: '3,1'
                }
            ]
        })
    })

    it("doesn't wall the expanding player's own knight off from its castle chain", () => {
        // Expanding onto a square holding your OWN knight is legal, but the wall ring drawn
        // around the new square must honour the same rule PlaceWall enforces: no wall
        // between a knight and a castle of the same prince, or between two of that prince's
        // knights. Ringing it unconditionally stranded the knight beyond it - a position no
        // wall placement could produce - and that in turn disabled Renegade against this
        // colour entirely (see isKnightSafeToRemove).
        const board = blankBoard()
        board.squares[0][2] = { type: SquareType.Blank, castleOwner: 'p1' } // (2,0)
        board.squares[1][2] = { type: SquareType.Blank } // (2,1), in the region
        board.squares[1][3] = { type: SquareType.Blank, knightOwner: 'p1' } // (3,1) expanded onto
        board.squares[1][4] = { type: SquareType.Blank, knightOwner: 'p1' } // (4,1) mustn't be cut off
        const state = buildState({
            board,
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['2,0', '2,1'], castleSquareKey: '2,0' }
            ]
        })
        expect(isKnightSafeToRemove(state, 'p1', 4, 1)).toBe(true)

        const action = makeExpandRegion('p1', 'r1', { col: 3, row: 1 })
        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        // No wall between p1's two knights at (3,1) and (4,1)...
        expect(isWalledBetween(state.board, 3, 1, 4, 1)).toBe(false)
        // ...so (4,1) is still connected to p1's castle, and Renegade still works.
        expect(isKnightSafeToRemove(state, 'p1', 4, 1)).toBe(true)
        // The ring is still drawn everywhere it's allowed - e.g. below the claimed square.
        expect(isWalledBetween(state.board, 3, 1, 3, 2)).toBe(true)
    })

    it('scores two strandings from one expansion on their combined total, not separately', () => {
        // "If a player loses spaces in two or more neutral zones, the spaces are added
        // together to determine the lost power points." A 1-2 space expansion is two
        // actions, so each stranding used to get its own table lookup: 1 space (-3) then
        // another (-3) instead of a single lookup on 2 combined spaces (-3).
        const board = blankBoard()
        // Invader (Pink): row 0, cols 5-9. Castle (7,0), knights (6,0) and (8,0) - 2 knights,
        // outnumbering Yellow's 1. Sitting directly above the victim's row means BOTH taken
        // squares are adjacent to Pink's region, which expansion requires.
        board.squares[0][6] = { type: SquareType.Blank, knightOwner: 'p1' }
        board.squares[0][7] = { type: SquareType.Blank, castleOwner: 'p1' }
        board.squares[0][8] = { type: SquareType.Blank, knightOwner: 'p1' }
        // Victim (Yellow): row 1, cols 5-9, castle in the middle at (7,1). Taking (6,1)
        // strands (5,1); taking (8,1) strands (9,1). Yellow's single knight is on (5,1) - it
        // must not be on either square Pink takes, since another prince's knight blocks
        // expansion outright.
        board.squares[1][5] = { type: SquareType.Blank, knightOwner: 'p2' }
        board.squares[1][7] = { type: SquareType.Blank, castleOwner: 'p2' }
        const state = buildState({
            board,
            regions: [
                {
                    id: 'r1',
                    owner: 'p1',
                    squareKeys: ['5,0', '6,0', '7,0', '8,0', '9,0'],
                    castleSquareKey: '7,0'
                },
                {
                    id: 'r2',
                    owner: 'p2',
                    squareKeys: ['5,1', '6,1', '7,1', '8,1', '9,1'],
                    castleSquareKey: '7,1'
                }
            ]
        })
        state.getPlayerState('p2').powerPoints = 100

        // 1st space: take (6,1), stranding (5,1) - 1 space, table value 3.
        const first = makeExpandRegion('p1', 'r1', { col: 6, row: 1 })
        expect(first.invalidExpandRegionReason(state)).toBeUndefined()
        first.apply(state)
        expect(first.metadata?.invasions?.[0].disconnectedPointsLost).toBe(3)

        // 2nd space of the SAME expansion: take (8,1), stranding (9,1). Combined that's 2
        // stranded spaces - still table value 3 - so nothing further is owed for it.
        const second = makeExpandRegion('p1', 'r1', { col: 8, row: 1 })
        expect(second.invalidExpandRegionReason(state)).toBeUndefined()
        second.apply(state)
        expect(second.metadata?.invasions?.[0].disconnectedSpaces).toBe(1)
        expect(second.metadata?.invasions?.[0].disconnectedPointsLost).toBe(0)

        // 100 - (1 direct + 3 stranded) - (1 direct + 0) = 95, the rulebook's total.
        expect(state.getPlayerState('p2').powerPoints).toBe(95)
    })

    it('absorbs a neutral zone space, shrinking it', () => {
        const state = buildState({
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
                { id: 'neutral', owner: undefined, squareKeys: ['1,0', '2,0'] }
            ]
        })
        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        expect(action.isValidExpandRegion(state)).toBe(true)
        action.apply(state)

        expect(state.regions.find((r) => r.id === 'r1')!.squareKeys).toEqual(['0,0', '1,0'])
        const neutralZone = state.regions.find((r) => r.id === 'neutral')
        expect(neutralZone?.squareKeys).toEqual(['2,0'])
        // A wall now separates the newly-claimed (1,0) from the remaining neutral
        // square (2,0) - the region must stay enclosed even from unclaimed territory.
        expect(state.board.walls).toEqual(
            expect.arrayContaining([{ col: 2, row: 0, edge: WallEdge.West }])
        )
    })

    it('deletes a neutral zone entirely once fully absorbed', () => {
        const state = buildState({
            regions: [
                { id: 'r1', owner: 'p1', squareKeys: ['0,0'] },
                { id: 'neutral', owner: undefined, squareKeys: ['1,0'] }
            ]
        })
        const action = makeExpandRegion('p1', 'r1', { col: 1, row: 0 })
        action.apply(state)

        expect(state.regions.find((r) => r.id === 'neutral')).toBeUndefined()
    })
})
