// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { Definition, MarbleColor, ZertzInfo, ZertzRuntime } from '@tabletop/zertz'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(ZertzRuntime)

const { White, Grey, Black } = MarbleColor
const marbles = (white, grey, black) => ({ [White]: white, [Grey]: grey, [Black]: black })

/** A standard game with Player 1 to move, the given rings removed and marbles placed. */
function position({ removed = [], placed = [], captured = [marbles(0, 0, 0), marbles(0, 0, 0)] }) {
    const game = ZertzRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'zertz',
            ownerId: 'owner',
            config: defaultGameConfig(ZertzInfo.configurator?.options ?? []),
            players: ['player-1', 'player-2'].map((id, index) => ({
                id,
                name: `Player ${index + 1}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState: state } = engine.startGame(game, {
        startingPositions: { playerIds: ['player-1', 'player-2'] }
    })
    const isRemoved = (ring) => removed.some(([q, r]) => ring.coords.q === q && ring.coords.r === r)
    state.board.rings = state.board.rings.filter((ring) => !isRemoved(ring))
    for (const [q, r, color] of placed) {
        const ring = state.board.rings.find(
            (candidate) => candidate.coords.q === q && candidate.coords.r === r
        )
        ring.marble = color
        state.pool[color] -= 1
    }
    state.players.forEach((player, index) => {
        player.captured = captured[index]
        for (const color of [White, Grey, Black]) {
            state.pool[color] -= captured[index][color]
        }
    })
    return { game: startedGame, state }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

write(
    'one-capture-from-winning',
    'One capture from winning',
    position({
        removed: [
            [3, 0],
            [3, -1],
            [-3, 3],
            [0, 3]
        ],
        placed: [
            [0, 0, White],
            [1, 0, Black]
        ],
        captured: [marbles(3, 3, 2), marbles(1, 2, 1)]
    })
)

write(
    'capture-chain',
    'Capture chain',
    position({
        removed: [
            [3, 0],
            [-3, 3]
        ],
        placed: [
            [0, 0, White],
            [1, 0, Grey],
            [2, -1, Black]
        ]
    })
)

write(
    'claim-by-ring-removal',
    'Claim by ring removal',
    position({
        removed: [
            [-3, 2],
            [-2, 1],
            [-1, 3],
            [-1, 2]
        ],
        placed: [
            [-3, 3, White],
            [-2, 3, Grey]
        ]
    })
)
