// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Color, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { BoardSize, Definition, HexInfo, HexRuntime, HydratedHexBoard } from '@tabletop/hex'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(HexRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'

// Alice plays Red and Bob Blue, on the 11 board; `toMove` is whose turn it is.
function position({ red, blue, toMove = FIRST, swapped = false }) {
    const game = HexRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'hex',
            ownerId: 'owner',
            config: defaultGameConfig(HexInfo.configurator?.options ?? []),
            players: [FIRST, SECOND].map((id, index) => ({
                id,
                name: index === 0 ? 'Alice' : 'Bob',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState: state } = engine.startGame(game, {
        startingPositions: { playerIds: [FIRST, SECOND] }
    })
    const board = new HydratedHexBoard({ size: BoardSize.Eleven, stones: [] })
    const order = Math.max(red.length, blue.length)
    for (let index = 0; index < order; index++) {
        if (red[index]) board.place(red[index], Color.Red)
        if (blue[index]) board.place(blue[index], Color.Blue)
    }
    for (const color of [Color.Red, Color.Blue]) {
        if (board.winningChainOf(color)) throw Error(`${color} has already won`)
    }
    state.board = { size: BoardSize.Eleven, stones: board.stones }
    state.swapped = swapped
    state.activePlayerIds = [toMove]
    state.turnManager.series = [{ ...state.turnManager.series[0], playerId: toMove }]
    return { game: startedGame, state }
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

for (const old of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, old))
}

write('swap-or-place', 'Swap or place', position({ red: ['F6'], blue: [], toMove: SECOND }))

// Alice's red chain runs from the top edge to the bottom but for D6, between D5 and C7.
write(
    'red-one-from-a-win',
    'Red one from a win',
    position({
        red: ['F1', 'F2', 'E3', 'E4', 'D5', 'C7', 'C8', 'B9', 'B10', 'A11'],
        blue: ['G5', 'H4', 'C4', 'B6', 'E6', 'F5', 'H8', 'G9', 'I3', 'J6']
    })
)

// Bob's blue row 6 runs from the left edge to J6, one short of the right edge.
write(
    'blue-one-from-a-win',
    'Blue one from a win',
    position({
        red: ['F1', 'F2', 'F3', 'F4', 'E5', 'K5', 'E7', 'D8', 'D9', 'C10', 'H9'],
        blue: ['A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6'],
        toMove: SECOND
    })
)

// A board in the middle of a game: seeded random cells of both colours, neither joined up.
let seed = 23
const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
}
const crowd = { red: [], blue: [] }
const board = new HydratedHexBoard({ size: BoardSize.Eleven, stones: [] })
for (const cell of board.grid.cells.toSorted(() => random() - 0.5)) {
    if (crowd.red.length + crowd.blue.length >= 50) break
    const color = crowd.red.length <= crowd.blue.length ? Color.Red : Color.Blue
    board.place(cell, color)
    if (board.winningChainOf(color)) {
        board.stones.pop()
        continue
    }
    crowd[color].push(cell)
}
write('middle-game', 'Middle game', position(crowd))
console.log(`Middle game: ${crowd.red.length} red, ${crowd.blue.length} blue`)
