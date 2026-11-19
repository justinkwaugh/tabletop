// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Color, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    BoardShape,
    HydratedYBoard,
    neighborsOf,
    POINTS,
    Side,
    sidesOf,
    YInfo,
    TOP_CORNER,
    YRuntime
} from '@tabletop/game-of-y'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(YRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'

// Alice plays Black and Bob White; `toMove` is whose turn it is.
function position({ black, white, toMove = FIRST, swapped = false }) {
    const game = YRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'game-of-y',
            ownerId: 'owner',
            config: defaultGameConfig(YInfo.configurator?.options ?? []),
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
    const board = new HydratedYBoard({ shape: BoardShape.Kadon, stones: [] })
    const order = Math.max(black.length, white.length)
    for (let index = 0; index < order; index++) {
        if (black[index]) board.place(black[index], Color.Black)
        if (white[index]) board.place(white[index], Color.White)
    }
    for (const color of [Color.Black, Color.White]) {
        if (board.yChainOf(color)) throw Error(`${color} already has a Y`)
    }
    state.board = { shape: BoardShape.Kadon, stones: board.stones }
    state.swapped = swapped
    state.activePlayerIds = [toMove]
    state.turnManager.series = [{ ...state.turnManager.series[0], playerId: toMove }]
    return { game: startedGame, state }
}

// The shortest run of points from `from` to any point `reached` accepts, avoiding `blocked`.
function pathTo(from, reached, blocked = new Set()) {
    const previous = new Map([[from, undefined]])
    const queue = [from]
    for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
        if (reached(current)) {
            const path = [current]
            for (let step = previous.get(current); step !== undefined; step = previous.get(step)) {
                path.unshift(step)
            }
            return path
        }
        for (const next of neighborsOf(current)) {
            if (!previous.has(next) && !blocked.has(next)) {
                previous.set(next, current)
                queue.push(next)
            }
        }
    }
    throw Error(`No path from ${from}`)
}

const onSide = (side) => (point) => sidesOf(point).includes(side)

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

for (const old of readdirSync(OUT).filter((file) => file.endsWith('.json'))) {
    rmSync(join(OUT, old))
}

write('swap-or-place', 'Swap or place', position({ black: ['E5'], white: [], toMove: SECOND }))

// Alice's chain runs from the left side to the right, with a branch down that stops one point
// short of the bottom side.
const corners = new Set(POINTS.filter((point) => sidesOf(point).length === 2))
const otherSides = new Set(
    POINTS.filter((point) => sidesOf(point).length > 0 && point !== 'A4' && point !== 'L4')
)
const across = pathTo('A4', (point) => point === 'L4', otherSides)
const down = pathTo(
    across[Math.floor(across.length / 2)],
    (point) => onSide(Side.Bottom)(point) && !corners.has(point),
    new Set([...across].filter((point) => point !== across[Math.floor(across.length / 2)]))
)
const winning = down.at(-1)
const blackChain = [...new Set([...across, ...down.slice(0, -1)])]
const taken = new Set([...blackChain, winning])
const whiteStones = POINTS.filter((point) => !taken.has(point))
    .filter((_, index) => index % 5 === 2)
    .slice(0, blackChain.length - 1)
write('one-from-a-y', 'One from a Y', position({ black: blackChain, white: whiteStones }))
console.log(`One from a Y: Alice wins on ${winning}`)

// A full-looking board: seeded random stones on most points, neither colour joined up.
let seed = 17
const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
}
const crowd = { black: [], white: [] }
const board = new HydratedYBoard({ shape: BoardShape.Kadon, stones: [] })
// The top corner always holds a stone, to judge how close the A9 label sits above one.
const shuffled = POINTS.toSorted(() => random() - 0.5).filter((point) => point !== TOP_CORNER)
for (const point of [TOP_CORNER, ...shuffled]) {
    if (crowd.black.length + crowd.white.length >= 60) break
    const color = crowd.black.length <= crowd.white.length ? Color.Black : Color.White
    board.place(point, color)
    if (board.yChainOf(color)) {
        board.stones.pop()
        continue
    }
    crowd[color === Color.Black ? 'black' : 'white'].push(point)
}
write('crowded-board', 'Crowded board', position(crowd))
console.log(`Crowded board: ${crowd.black.length} black, ${crowd.white.length} white`)
