import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    type GameAction,
    type GameConfig,
    type Point
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { MedinaRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { PalaceColor, Tower, WallSide } from '../components/pieces.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from './gameState.js'

const engine = new GameEngine(MedinaRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number, config: GameConfig = { teaTiles: true }) {
    return MedinaRuntime.initializer.initializeGame(
        {
            id: 'medina-rules',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 11,
            config,
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function start(count: number, config?: GameConfig): HydratedMedinaGameState {
    const { initialState } = engine.startGame(createGame(count, config), { masterSeed })
    const state = new HydratedMedinaGameState(structuredClone(initialState))
    state.well = { x: 12, y: 8 }
    state.marketStreets = [[{ x: 14, y: 1 }]]
    return state
}

function withPalace(
    state: HydratedMedinaGameState,
    id: string,
    color: PalaceColor,
    spaces: Point[],
    owner?: string
) {
    state.palaces.push({
        id,
        color,
        ...(owner ? { rooftop: { coords: spaces[0], playerId: owner } } : {})
    })
    for (const coords of spaces) {
        state.buildings.push({ coords, palaceId: id })
    }
}

function spaceKeys(spaces: Point[]): string[] {
    return spaces.map((space) => `${space.x},${space.y}`).toSorted()
}

describe('building spaces', () => {
    it('allows a first building anywhere clear of the well', () => {
        const state = start(4)
        const spaces = spaceKeys(state.buildingSpaces(PalaceColor.Orange))
        expect(spaces).toContain('0,0')
        expect(spaces).toContain('15,10')
        expect(spaces).not.toContain('12,8')
        expect(spaces).not.toContain('11,7')
        expect(spaces).not.toContain('13,9')
    })

    it('must extend an unfinished palace of that colour', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }])
        expect(spaceKeys(state.buildingSpaces(PalaceColor.Orange))).toEqual(
            spaceKeys([
                { x: 2, y: 3 },
                { x: 4, y: 3 },
                { x: 3, y: 2 },
                { x: 3, y: 4 }
            ])
        )
    })

    it('keeps an alley to other palaces, diagonals included', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }])
        withPalace(state, 'b', PalaceColor.Grey, [{ x: 5, y: 4 }])
        const spaces = spaceKeys(state.buildingSpaces(PalaceColor.Orange))
        expect(spaces).not.toContain('4,3')
        expect(spaces).toContain('3,2')
    })

    it('starts a new palace once a claimed one blocks the colour', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }], 'p0')
        const spaces = spaceKeys(state.buildingSpaces(PalaceColor.Orange))
        expect(spaces).not.toContain('4,3')
        expect(spaces).toContain('8,8')
    })

    it('starts a new palace when the unfinished one cannot grow', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 0, y: 0 }])
        state.marketStreets = [
            [
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 }
            ]
        ]
        const spaces = spaceKeys(state.buildingSpaces(PalaceColor.Orange))
        expect(spaces).toContain('8,8')
        expect(spaces.length).toBeGreaterThan(50)
    })
})

describe('stable spaces', () => {
    it('sits beside a building, claimed or not, keeping clear of other palaces', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }], 'p0')
        withPalace(state, 'b', PalaceColor.Grey, [{ x: 5, y: 4 }])
        const spaces = state.stableSpaces()
        expect(spaces.find((space) => space.coords.x === 3 && space.coords.y === 2)?.palaceId).toBe(
            'a'
        )
        expect(spaces.some((space) => space.coords.x === 4 && space.coords.y === 3)).toBe(false)
    })

    it('needs a building, not just another stable', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }])
        state.stables.push({ coords: { x: 4, y: 3 }, palaceId: 'a' })
        expect(state.stableSpaces().some((space) => space.coords.x === 5)).toBe(false)
    })
})

describe('the market street', () => {
    it('grows from either end and never touches two merchants', () => {
        const state = start(4)
        state.marketStreets = [
            [
                { x: 5, y: 5 },
                { x: 6, y: 5 },
                { x: 6, y: 4 }
            ]
        ]
        expect(spaceKeys(state.merchantSpaces())).toEqual(
            spaceKeys([
                { x: 4, y: 5 },
                { x: 5, y: 6 },
                { x: 5, y: 4 },
                { x: 7, y: 4 },
                { x: 6, y: 3 }
            ]).filter((key) => key !== '5,4')
        )
    })

    it('lists each space once while the street is a single merchant', () => {
        const state = start(4)
        state.marketStreets = [[{ x: 5, y: 5 }]]
        expect(spaceKeys(state.merchantSpaces())).toEqual(
            spaceKeys([
                { x: 6, y: 5 },
                { x: 4, y: 5 },
                { x: 5, y: 6 },
                { x: 5, y: 4 }
            ])
        )
    })

    it('starts a new street away from the old one when both ends are blocked', () => {
        const state = start(4)
        state.marketStreets = [[{ x: 0, y: 0 }]]
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 1, y: 0 }], 'p0')
        withPalace(state, 'b', PalaceColor.Brown, [{ x: 0, y: 1 }], 'p1')
        const spaces = spaceKeys(state.merchantSpaces())
        expect(spaces).toContain('8,8')
        state.addMerchant({ x: 8, y: 8 })
        expect(state.marketStreets).toHaveLength(2)
        expect(spaceKeys(state.merchantSpaces())).toContain('9,8')
    })
})

describe('walls', () => {
    it('start at a tower and grow from a wall', () => {
        const state = start(4)
        expect(state.wallSections()).toContainEqual({ side: WallSide.North, position: 0 })
        expect(state.wallSections()).toContainEqual({ side: WallSide.North, position: 15 })
        expect(state.wallSections()).not.toContainEqual({ side: WallSide.North, position: 5 })
        state.walls.push({ side: WallSide.North, position: 0 })
        expect(state.wallSections()).toContainEqual({ side: WallSide.North, position: 1 })
    })

    it('leave a gate where two towers meet', () => {
        const state = start(4)
        for (let position = 0; position < 8; position++) {
            state.walls.push({ side: WallSide.North, position })
        }
        for (let position = 9; position < 16; position++) {
            state.walls.push({ side: WallSide.North, position })
        }
        expect(state.wallSections()).not.toContainEqual({ side: WallSide.North, position: 8 })
    })

    it('belong to the tower they grew from', () => {
        const state = start(4)
        state.walls.push(
            { side: WallSide.North, position: 0 },
            { side: WallSide.North, position: 15 }
        )
        expect(state.towerOfWall({ side: WallSide.North, position: 0 })).toBe(Tower.NorthWest)
        expect(state.towerOfWall({ side: WallSide.North, position: 15 })).toBe(Tower.NorthEast)
    })
})

describe('tiles', () => {
    it('gives the palace tile to the first claim and moves it only for a larger palace', () => {
        const state = start(4)
        const palaces = [
            { id: 'a', spaces: [{ x: 1, y: 1 }] },
            { id: 'b', spaces: [{ x: 5, y: 1 }] },
            {
                id: 'c',
                spaces: [
                    { x: 9, y: 1 },
                    { x: 9, y: 2 }
                ]
            }
        ]
        for (const palace of palaces) {
            withPalace(state, palace.id, PalaceColor.Orange, palace.spaces)
        }
        const tile = () =>
            state.palaceTiles.find((candidate) => candidate.color === PalaceColor.Orange)
        expect(state.claimPalace(state.palace('a'), { x: 1, y: 1 }, 'p0').palaceTile).toBe(
            PalaceColor.Orange
        )
        expect(tile()?.palaceId).toBe('a')
        expect(
            state.claimPalace(state.palace('b'), { x: 5, y: 1 }, 'p1').palaceTile
        ).toBeUndefined()
        expect(tile()?.palaceId).toBe('a')
        expect(state.claimPalace(state.palace('c'), { x: 9, y: 1 }, 'p2').palaceTile).toBe(
            PalaceColor.Orange
        )
        expect(tile()?.palaceId).toBe('c')
    })

    it('moves the palace tile when a stable makes a claimed palace larger', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 1, y: 1 }])
        withPalace(state, 'b', PalaceColor.Orange, [{ x: 5, y: 1 }])
        state.claimPalace(state.palace('a'), { x: 1, y: 1 }, 'p0')
        state.claimPalace(state.palace('b'), { x: 5, y: 1 }, 'p1')
        state.stables.push({ coords: { x: 5, y: 2 }, palaceId: 'b' })
        state.extendClaimedPalace(state.palace('b'), { x: 5, y: 2 })
        expect(
            state.palaceTiles.find((candidate) => candidate.color === PalaceColor.Orange)?.palaceId
        ).toBe('b')
    })

    it('gives the first watcher the tower tile and its merchants, later watchers only the tile', () => {
        const state = start(4)
        state.walls.push(
            { side: WallSide.North, position: 0 },
            { side: WallSide.North, position: 1 }
        )
        state.walls.push(
            { side: WallSide.North, position: 2 },
            { side: WallSide.North, position: 3 }
        )
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 0, y: 0 }])
        withPalace(state, 'b', PalaceColor.Brown, [{ x: 3, y: 0 }])
        const merchants = state.getPlayerState('p0').merchantsLeft()
        const first = state.claimPalace(state.palace('a'), { x: 0, y: 0 }, 'p0')
        expect(first.towers).toEqual([Tower.NorthWest])
        expect(first.merchants).toBe(3)
        expect(state.getPlayerState('p0').merchantsLeft()).toBe(merchants + 3)
        const second = state.claimPalace(state.palace('b'), { x: 3, y: 0 }, 'p1')
        expect(second.merchants).toBe(0)
        expect(state.towerTiles.find((tile) => tile.tower === Tower.NorthWest)?.palaceId).toBe('b')
    })

    it('moves the tower tile when a wall reaches a claimed palace', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 0, y: 0 }], 'p0')
        state.walls.push({ side: WallSide.North, position: 0 })
        const awards = state.wallReachesPalace({ side: WallSide.North, position: 0 })
        expect(awards?.towers).toEqual([Tower.NorthWest])
        expect(state.getPlayerState('p0').merchants).toBe(6 + 3)
    })

    it('moves the tower tile when a stable reaches a wall', () => {
        const state = start(4)
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 4, y: 1 }], 'p0')
        for (let position = 0; position < 5; position++) {
            state.walls.push({ side: WallSide.North, position })
        }
        state.stables.push({ coords: { x: 4, y: 0 }, palaceId: 'a' })
        const awards = state.extendClaimedPalace(state.palace('a'), { x: 4, y: 0 })
        expect(awards.towers).toEqual([Tower.NorthWest])
    })

    it('counts down the tea tiles for each purple claim', () => {
        const state = start(4)
        expect(state.teaTilesForNextPurpleClaim()).toBe(3)
        withPalace(state, 'a', PalaceColor.Purple, [{ x: 0, y: 0 }], 'p0')
        expect(state.teaTilesForNextPurpleClaim()).toBe(2)
        withPalace(state, 'b', PalaceColor.Purple, [{ x: 5, y: 0 }], 'p1')
        withPalace(state, 'c', PalaceColor.Purple, [{ x: 9, y: 0 }], 'p2')
        withPalace(state, 'd', PalaceColor.Purple, [{ x: 13, y: 0 }], 'p3')
        expect(state.teaTilesForNextPurpleClaim()).toBe(0)
    })

    it('stores nothing for a game with tea tiles, the same State as a game from before the option', () => {
        expect('noTeaTiles' in start(4, { teaTiles: true })).toBe(false)
        expect(start(4, {}).noTeaTiles).toBe(true)
    })

    it.each([
        ['with tea tiles', { teaTiles: true }, 3],
        ['without tea tiles', {}, 0]
    ])('awards a purple claim the right tiles %s', (_name, config: GameConfig, tiles) => {
        const game = createGame(3, config)
        const { initialState } = engine.startGame(game, { masterSeed })
        const coords = new HydratedMedinaGameState(structuredClone(initialState)).buildingSpaces(
            PalaceColor.Purple
        )[0]
        const placed = act(initialState, game, {
            type: ActionType.PlaceBuilding,
            color: PalaceColor.Purple,
            coords
        })
        const [claimer] = placed.activePlayerIds
        const claimed = act(placed, game, { type: ActionType.PlaceRooftop, coords, neutral: false })
        const hydrated = new HydratedMedinaGameState(claimed)
        expect(hydrated.getPlayerState(claimer).teaTiles).toBe(tiles)
    })
})

describe('rooftops', () => {
    it('allows one palace per colour for a player, and neutral rooftops anywhere', () => {
        const state = start(3)
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 1, y: 1 }], 'p0')
        withPalace(state, 'b', PalaceColor.Grey, [{ x: 5, y: 1 }])
        expect(state.claimablePalaces('p0', false)).toEqual([])
        expect(state.claimablePalaces('p1', false).map((palace) => palace.id)).toEqual(['b'])
        expect(state.claimablePalaces('p0', true).map((palace) => palace.id)).toEqual(['b'])
    })

    it('returns a colour once every player has claimed it, neutral rooftops aside', () => {
        const state = start(2)
        withPalace(state, 'a', PalaceColor.Grey, [{ x: 1, y: 1 }], 'p0')
        expect(state.returnBuildingsOnceEveryoneClaimed(PalaceColor.Grey)).toBe(false)
        withPalace(state, 'b', PalaceColor.Grey, [{ x: 5, y: 1 }], 'p1')
        expect(state.returnBuildingsOnceEveryoneClaimed(PalaceColor.Grey)).toBe(true)
        expect(state.getPlayerState('p0').buildingStock()[PalaceColor.Grey]).toBe(0)
    })
})

describe('scoring', () => {
    it('adds buildings, stables, bordering walls, adjacent merchants and the well', () => {
        const state = start(4)
        state.well = { x: 8, y: 5 }
        withPalace(
            state,
            'a',
            PalaceColor.Orange,
            [
                { x: 6, y: 5 },
                { x: 5, y: 5 }
            ],
            'p0'
        )
        state.stables.push({ coords: { x: 5, y: 6 }, palaceId: 'a' })
        state.marketStreets = [[{ x: 6, y: 4 }]]
        expect(state.palaceScore(state.palace('a'))).toEqual({
            palaceId: 'a',
            color: PalaceColor.Orange,
            buildings: 2,
            stables: 1,
            walls: 0,
            merchants: 1,
            well: 4,
            total: 8
        })
    })

    it('offers the four spaces one straight space from the well, inside the city', () => {
        const state = start(4)
        state.well = { x: 8, y: 5 }
        expect(spaceKeys(state.wellBonusSpaces())).toEqual(
            spaceKeys([
                { x: 10, y: 5 },
                { x: 6, y: 5 },
                { x: 8, y: 7 },
                { x: 8, y: 3 }
            ])
        )
        state.well = { x: 1, y: 1 }
        expect(spaceKeys(state.wellBonusSpaces())).toEqual(
            spaceKeys([
                { x: 3, y: 1 },
                { x: 1, y: 3 }
            ])
        )
    })

    it('scores 4 for each building or stable one space from the well', () => {
        const state = start(4)
        state.well = { x: 8, y: 5 }
        withPalace(
            state,
            'a',
            PalaceColor.Purple,
            [
                { x: 8, y: 3 },
                { x: 10, y: 5 }
            ],
            'p0'
        )
        expect(state.palaceScore(state.palace('a')).well).toBe(8)
    })

    it('counts each wall and merchant once for a palace, however many pieces touch it', () => {
        const state = start(4)
        withPalace(
            state,
            'a',
            PalaceColor.Grey,
            [
                { x: 0, y: 0 },
                { x: 1, y: 0 }
            ],
            'p0'
        )
        state.walls.push(
            { side: WallSide.North, position: 0 },
            { side: WallSide.West, position: 0 }
        )
        state.marketStreets = [[{ x: 0, y: 1 }]]
        const score = state.palaceScore(state.palace('a'))
        expect(score.walls).toBe(2)
        expect(score.merchants).toBe(1)
    })

    it('scores tiles for their owners and nothing for neutral palaces', () => {
        const state = start(3)
        withPalace(state, 'a', PalaceColor.Orange, [{ x: 3, y: 3 }])
        state.claimPalace(state.palace('a'), { x: 3, y: 3 }, undefined)
        withPalace(state, 'b', PalaceColor.Orange, [{ x: 7, y: 3 }])
        state.claimPalace(state.palace('b'), { x: 7, y: 3 }, 'p1')
        const scores = state.scores()
        expect(scores.p0.total).toBe(0)
        expect(scores.p1.total).toBe(1)
    })
})

function act(
    state: MedinaProjectedState,
    game: ReturnType<typeof createGame>,
    action: Omit<GameAction, 'id' | 'gameId' | 'source' | 'playerId'> & Record<string, unknown>
) {
    const [playerId] = state.activePlayerIds
    return engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: `a${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            ...action
        }
    }).updatedState
}

describe('turns', () => {
    function firstOpenSpace(state: MedinaProjectedState, offset: number): Point {
        const hydrated = new HydratedMedinaGameState(structuredClone(state))
        return hydrated.buildingSpaces(PalaceColor.Orange)[offset]
    }

    it.each([
        [2, 1],
        [3, 2],
        [4, 2]
    ])('in a %i player game the first %i turns place one piece', (count, singles) => {
        const game = createGame(count)
        let { initialState: state } = engine.startGame(game, { masterSeed })
        const order = state.turnManager.turnOrder
        for (let turn = 0; turn < singles; turn++) {
            expect(state.activePlayerIds).toEqual([order[turn]])
            expect(state.turn?.placementsLeft).toBe(1)
            state = act(state, game, {
                type: ActionType.PlaceWall,
                side: WallSide.North,
                position: turn
            })
        }
        expect(state.activePlayerIds).toEqual([order[singles % count]])
        expect(state.turn?.placementsLeft).toBe(2)
    })

    function turnWithTea() {
        const game = createGame(4)
        let { initialState: state } = engine.startGame(game, { masterSeed })
        state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.North, position: 0 })
        state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.North, position: 1 })
        const [playerId] = state.activePlayerIds
        const hydrated = new HydratedMedinaGameState(structuredClone(state))
        hydrated.getPlayerState(playerId).teaTiles = 2
        return { game, playerId, state: hydrated.dehydrate() }
    }

    it('lets a player take a tea break before placing, then place the one piece left', () => {
        const { game, playerId, state: start } = turnWithTea()
        expect(new HydratedMedinaGameState(start).canTakeTeaBreak(playerId)).toBe(true)
        let state = act(start, game, { type: ActionType.TakeTeaBreak })
        expect(state.activePlayerIds).toEqual([playerId])
        expect(state.turn?.placementsLeft).toBe(1)
        const hydrated = new HydratedMedinaGameState(state)
        expect(hydrated.getPlayerState(playerId).teaTiles).toBe(1)
        expect(hydrated.canTakeTeaBreak(playerId)).toBe(false)
        state = act(state, game, {
            type: ActionType.PlaceBuilding,
            color: PalaceColor.Orange,
            coords: firstOpenSpace(state, 0)
        })
        expect(state.activePlayerIds).not.toEqual([playerId])
    })

    it('lets a player take a tea break after the first piece, ending the turn', () => {
        const { game, playerId, state: start } = turnWithTea()
        let state = act(start, game, {
            type: ActionType.PlaceBuilding,
            color: PalaceColor.Orange,
            coords: firstOpenSpace(start, 0)
        })
        expect(new HydratedMedinaGameState(state).canTakeTeaBreak(playerId)).toBe(true)
        state = act(state, game, { type: ActionType.TakeTeaBreak })
        expect(state.activePlayerIds).not.toEqual([playerId])
        expect(new HydratedMedinaGameState(state).getPlayerState(playerId).teaTiles).toBe(1)
    })

    it('remembers a tea break until the player next takes a turn', () => {
        const { game, playerId, state: start } = turnWithTea()
        let state = act(start, game, { type: ActionType.TakeTeaBreak })
        const tookTea = () =>
            new HydratedMedinaGameState(state).getPlayerState(playerId).tookTeaBreak
        expect(tookTea()).toBe(true)
        state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.South, position: 0 })
        expect(state.activePlayerIds).not.toEqual([playerId])
        expect(tookTea()).toBe(true)
        for (let position = 1; state.activePlayerIds[0] !== playerId; position++) {
            state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.South, position })
        }
        expect(tookTea()).toBe(false)
    })

    it('offers no tea break on an opening turn of one piece', () => {
        const game = createGame(4)
        const { initialState } = engine.startGame(game, { masterSeed })
        const [playerId] = initialState.activePlayerIds
        const hydrated = new HydratedMedinaGameState(structuredClone(initialState))
        hydrated.getPlayerState(playerId).teaTiles = 1
        expect(hydrated.canTakeTeaBreak(playerId)).toBe(false)
    })

    it('skips a player who has nothing left to place, and ends when nobody can', () => {
        const game = createGame(2)
        let { initialState: state } = engine.startGame(game, { masterSeed })
        const [first, second] = state.turnManager.turnOrder
        const hydrated = new HydratedMedinaGameState(structuredClone(state))
        for (const player of hydrated.players) {
            for (const color of Object.values(PalaceColor)) {
                player.buildingStock()[color] = 0
            }
            player.rooftops = 0
            player.neutralRooftops = 0
            player.stables = 0
            player.merchants = 0
            player.walls = 0
        }
        hydrated.getPlayerState(first).walls = 2
        state = hydrated.dehydrate()
        state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.North, position: 0 })
        expect(state.activePlayerIds).toEqual([first])
        state = act(state, game, { type: ActionType.PlaceWall, side: WallSide.North, position: 1 })
        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(second).toBeDefined()
    })
})
