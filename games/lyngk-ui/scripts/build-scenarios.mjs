// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { Definition, LyngkInfo, LyngkRuntime } from '@tabletop/lyngk'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(LyngkRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'

/**
 * A game with the first player to move and only the given stacks on the board.
 * stacks: [q, r, colors bottom to top]; claims and scored stacks per player id.
 */
function position(stacks, { claims = {}, scored = {}, variant = 'Standard' } = {}) {
    const game = LyngkRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'lyngk',
            ownerId: 'owner',
            config: { ...defaultGameConfig(LyngkInfo.configurator?.options ?? []), variant },
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
    for (const point of state.board.points) point.stack = []
    // Each piece gets its own identity, so the specks it is drawn with stay with it.
    let nextId = 0
    for (const [q, r, stack] of stacks) {
        const point = state.board.points.find((p) => p.coords.q === q && p.coords.r === r)
        if (!point) throw Error(`No point ${q},${r}`)
        point.stack = stack
        point.ids = stack.map(() => nextId++)
    }
    for (const point of state.board.points) {
        if (point.stack.length === 0) delete point.ids
    }
    for (const player of state.players) {
        player.claimed = claims[player.playerId] ?? []
        player.scored = scored[player.playerId] ?? []
    }
    return { game: startedGame, state }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

// Rule F, diagram 5: claim black, then link E7 through the black tops on E5 and G4 to land on
// G2 and complete a scoring stack of 5.
write(
    'lyngk-chain',
    'LYNGK chain',
    position(
        [
            [0, -3, ['black']],
            [0, -1, ['ivory', 'black']],
            [2, -1, ['green', 'black']],
            [2, 1, ['blue', 'ivory', 'red', 'green']],
            [1, -3, ['red']],
            [-2, 1, ['red']],
            [-1, 1, ['green']],
            [-3, 2, ['ivory']],
            [1, 1, ['ivory']],
            [3, -2, ['blue']],
            [0, 2, ['green', 'red']],
            [-1, -1, ['blue']],
            [3, -1, ['green']],
            [-2, 3, ['joker']]
        ],
        {
            claims: { [SECOND]: ['red'] },
            scored: { [SECOND]: [['ivory', 'blue', 'green', 'black', 'red']] }
        }
    )
)

// Rule E11: no neutral move is left for Alice, so she must claim a color that opens one.
write(
    'claim-to-move',
    'Claim to move',
    position(
        [
            [0, 0, ['green']],
            [0, 1, ['blue', 'red', 'black']],
            [0, 3, ['ivory']],
            [-3, 1, ['black']],
            [-3, 2, ['blue']]
        ],
        { claims: { [SECOND]: ['black', 'blue'] } }
    )
)

// Rule E12 and G: after Alice's move Bob has none and passes; Alice moves again, and then
// nobody can move, so the game ends and the stacks topped by each player's colors decide.
write(
    'pass-and-end',
    'Pass and end',
    position(
        [
            [0, -3, ['red']],
            [0, -2, ['green']],
            [0, 2, ['ivory']]
        ],
        { claims: { [FIRST]: ['red', 'green'], [SECOND]: ['black', 'blue'] } }
    )
)

// Variant H: landing the red on E3 makes a stack of 6 with a joker as white and wins at once.
write(
    'stack-of-six',
    'Stack of 6',
    position(
        [
            [0, 0, ['red']],
            [0, 1, ['joker', 'blue', 'ivory', 'green', 'black']],
            [-2, 2, ['green', 'ivory']],
            [2, -2, ['blue']]
        ],
        { claims: { [FIRST]: ['red', 'ivory'], [SECOND]: ['green'] }, variant: 'StackOfSix' }
    )
)

// All 43 pieces in play, piled high: stacks of 5 on E1 (on the near edge, under its label) and
// E4 (the centre), each with pieces on the three points behind it, where a tall stack reaches
// over its neighbours; a stack of 4 on E7, under the top label.
write(
    'tall-stacks',
    'Tall stacks',
    position(
        [
            [0, 3, ['ivory', 'green', 'red', 'black', 'blue']],
            [0, 2, ['red']],
            [1, 2, ['green']],
            [-1, 3, ['ivory']],
            [0, 0, ['joker', 'red', 'green', 'ivory', 'black']],
            [0, -1, ['blue']],
            [1, -1, ['black', 'ivory', 'green', 'red']],
            [-1, 0, ['green', 'blue', 'ivory']],
            [0, -3, ['blue', 'red', 'joker', 'green']],
            [2, 1, ['red', 'black', 'blue', 'ivory']],
            [-2, 2, ['black', 'joker', 'green']],
            [2, -2, ['ivory', 'blue']],
            [-2, -1, ['green', 'red']],
            [3, -3, ['black']],
            [-3, 1, ['blue', 'black']],
            [1, 1, ['blue']],
            [-1, -2, ['red', 'ivory']],
            [1, -3, ['black']]
        ],
        { claims: { [FIRST]: ['red'], [SECOND]: ['green'] } }
    )
)
