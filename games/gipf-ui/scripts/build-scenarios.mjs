// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { Definition, GipfInfo, GipfRuntime } from '@tabletop/gipf'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(GipfRuntime)
const WHITE = 'player-1'
const BLACK = 'player-2'

/** A Standard game with White to move and extra pieces placed: [q, r, owner, gipf]. */
function position(extra, { version = 'Standard' } = {}) {
    const game = GipfRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'gipf',
            ownerId: 'owner',
            config: { ...defaultGameConfig(GipfInfo.configurator?.options ?? []), version },
            players: [WHITE, BLACK].map((id, index) => ({
                id,
                name: index === 0 ? 'White' : 'Black',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState: state } = engine.startGame(game, {
        startingPositions: { playerIds: [WHITE, BLACK] }
    })
    for (const [q, r, playerId, gipf] of extra) {
        const spot = state.board.spots.find((s) => s.coords.q === q && s.coords.r === r)
        spot.piece = { playerId, gipf }
        state.players.find((p) => p.playerId === playerId).reserve -= gipf ? 2 : 1
    }
    return { game: startedGame, state }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

// Column d: D2 (-1,3) up to D7 (-1,-2).
write(
    'take-a-row',
    'Take a row',
    position([
        [-1, 2, WHITE, false],
        [-1, 1, WHITE, false],
        [-1, 0, WHITE, false],
        [-1, -1, BLACK, false],
        [-1, -2, BLACK, true]
    ])
)

// Pushing in from A3 (-4,1) onto B4 (-3,1) completes two white rows, B4–E4 and B4–E7, that share only B4, so
// taking either one breaks the other. A white GIPF-piece sits in the across row.
write(
    'crossing-rows',
    'Crossing rows',
    position([
        [-2, 1, WHITE, false],
        [-1, 1, WHITE, true],
        [0, 1, WHITE, false],
        [-2, 0, WHITE, false],
        [-1, -1, WHITE, false],
        [0, -2, WHITE, false]
    ])
)
