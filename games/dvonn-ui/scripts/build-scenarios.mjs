// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    DvonnInfo,
    DvonnRuntime,
    HydratedDvonnGameState,
    MachineState,
    SPACES,
    spaceName
} from '@tabletop/dvonn'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(DvonnRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'

/**
 * A stacking-phase game with Alice (White) to move. Stacks are space names to pieces read
 * bottom to top: w Alice's, b Bob's, d DVONN, or as the pieces themselves. Every other space is
 * empty.
 */
function position(stacks, machineState = MachineState.MovingStacks) {
    const game = DvonnRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'dvonn',
            ownerId: 'owner',
            config: defaultGameConfig(DvonnInfo.configurator?.options ?? []),
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
    // Each piece needs a space of its own to have been placed on, which seeds its specks.
    let placed = 0
    const nextOrigin = () => ({ ...SPACES[placed++ % SPACES.length] })
    for (const space of state.board.spaces) {
        const stack = stacks[spaceName(space.coords)] ?? ''
        space.stack =
            typeof stack === 'string'
                ? stack
                      .split('')
                      .map((letter) =>
                          letter === 'd'
                              ? { dvonn: true, placedAt: nextOrigin() }
                              : {
                                    playerId: letter === 'w' ? FIRST : SECOND,
                                    placedAt: nextOrigin()
                                }
                      )
                : stack
    }
    state.machineState = machineState
    state.activePlayerIds = [FIRST]
    const hydrated = new HydratedDvonnGameState(state)
    if (hydrated.board.dvonnCount() !== 3) throw Error('Wrong DVONN count')
    for (const player of state.players) {
        if (hydrated.board.piecesOf(player.playerId) > 23) throw Error('Too many pieces')
    }
    if (machineState === MachineState.MovingStacks && !hydrated.canMove(FIRST)) {
        throw Error('Alice cannot move')
    }
    return { game: startedGame, state }
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

// Plays seeded random moves from a random placement and returns the board as stacks, preferring
// moves onto the tallest stack so heights build up as they do between careful players.
function playedBoard({ seed, moves }) {
    const game = DvonnRuntime.initializer.initializeGame(
        {
            id: 'played',
            typeId: 'dvonn',
            ownerId: 'owner',
            seed,
            config: {
                ...defaultGameConfig(DvonnInfo.configurator?.options ?? []),
                version: 'RandomPlacement'
            },
            players: [FIRST, SECOND].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    let state = engine.startGame(game, {
        startingPositions: { playerIds: [FIRST, SECOND] }
    }).initialState
    let value = seed
    const random = () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
    for (let count = 0; count < moves; count++) {
        const hydrated = new HydratedDvonnGameState(state)
        const [playerId] = state.activePlayerIds
        const options = hydrated.movableStacks(playerId).flatMap((from) =>
            hydrated.board.destinationsFrom(from).map((to) => ({
                from,
                to,
                height: hydrated.board.stackAt(to).length + hydrated.board.stackAt(from).length
            }))
        )
        options.sort((a, b) => b.height - a.height)
        const choice = options[Math.floor(random() ** 2 * options.length)]
        state = engine.executeCanonicalAction({
            game,
            state,
            action: {
                id: `m${count}`,
                gameId: game.id,
                source: 'user',
                playerId,
                type: 'moveStack',
                from: choice.from,
                to: choice.to
            }
        }).updatedState
    }
    return Object.fromEntries(
        state.board.spaces
            .filter((space) => space.stack.length > 0)
            .map((space) => [spaceName(space.coords), space.stack])
    )
}

// A game well into stacking, with stacks of many heights, some holding DVONN pieces.
const midgame = playedBoard({ seed: 7, moves: 18 })
write('midgame', 'Midgame', position(midgame))

// Rule F1: C2 is the only link between the four stacks on A1–B2 and the DVONN pieces. Moving it
// onto D2 or D3 cuts them off, and they leave the board.
write(
    'cut-off',
    'Cut off',
    position({
        A1: 'b',
        A2: 'wb',
        B1: 'w',
        B2: 'b',
        C2: 'w',
        D2: 'bw',
        D3: 'w',
        D4: 'w',
        C4: 'd',
        E3: 'wb',
        E4: 'b',
        F3: 'w',
        G3: 'b',
        G4: 'w',
        H2: 'b',
        H3: 'd',
        I3: 'wb',
        J3: 'b',
        K3: 'd'
    })
)

// Rules E8 and G1: Bob's only stack, three high on F3, has nowhere to land. Once Alice moves,
// Bob passes and Alice moves again.
write(
    'bob-passes',
    'Bob passes',
    position({
        A1: 'd',
        B1: 'w',
        D3: 'w',
        E3: 'd',
        F3: 'wbb',
        J5: 'w',
        K5: 'd'
    })
)

// Rule G2: Alice's stack on D3 can only land on Bob's stack on F3. After that neither player can
// move, so the game ends: Alice controls four pieces, Bob none.
write(
    'last-move',
    'Last move',
    position({
        A1: 'd',
        D3: 'bw',
        E3: 'd',
        F3: 'bb',
        K5: 'd'
    })
)

// Rule E1: one space is left, and Alice, who placed the first DVONN piece, places the last piece
// and then makes the first move.
function nearlyFull() {
    const stacks = {}
    let index = 0
    for (const coords of SPACES) {
        const name = spaceName(coords)
        if (name === 'K3') continue
        stacks[name] = ['E3', 'H2', 'C4'].includes(name) ? 'd' : index++ % 2 === 0 ? 'b' : 'w'
    }
    return stacks
}
write('stacking-begins', 'Stacking begins', position(nearlyFull(), MachineState.PlacingPieces))

// The two spaces in the row behind a stack are the ones its height hides most: a single piece
// and a two-stack behind the 12-stack on F2, a DVONN piece and a three-stack behind the 9-stack
// on C2.
write(
    'behind-tall-stacks',
    'Behind tall stacks',
    position({
        F2: 'bwbwbbwdwbww',
        F3: 'b',
        G3: 'wb',
        C2: 'bbwbwwbbw',
        C3: 'd',
        D3: 'bwb',
        B2: 'w',
        B3: 'b',
        D2: 'w',
        E2: 'b',
        E3: 'w',
        G2: 'w',
        H3: 'b',
        K3: 'd'
    })
)
