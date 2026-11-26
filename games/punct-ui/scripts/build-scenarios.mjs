// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    Definition,
    HydratedPunctBoard,
    HydratedPunctGameState,
    PunctInfo,
    PunctRuntime,
    spaceAt
} from '@tabletop/punct'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(PunctRuntime)
// Each game starts from a fixed master seed, so every file comes out the same on each run.
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const WHITE = 'player-1'
const BLACK = 'player-2'
const KINDS = {
    T: 'triangle',
    E: 'straightEnd',
    C: 'straightCentre',
    A: 'angleCorner',
    L: 'angleLeft',
    R: 'angleRight'
}

function startedGame(variant = 'Standard') {
    const game = PunctRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'punct',
            ownerId: 'owner',
            config: { ...defaultGameConfig(PunctInfo.configurator?.options ?? []), variant },
            players: [WHITE, BLACK].map((id, index) => ({
                id,
                name: index === 0 ? 'White' : 'Black',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return engine.startGame(game, {
        masterSeed: MASTER_SEED,
        startingPositions: { playerIds: [WHITE, BLACK] }
    })
}

/**
 * White to move. Pieces are listed in the order they came to rest, each as
 * `<owner><kind> <PÜNCT space> <rotation>`: W or B, then T triangle, E straight with its PÜNCT
 * at an end, C straight with it in the centre, A angular with it at the corner, L or R angular
 * with it at an end, turning left or right. Each comes to rest where the rules put it, on the
 * board or on the pieces before it; the reserves hold the rest.
 */
function position(pieces, variant = 'Standard') {
    const { startedGame: game, initialState: state } = startedGame(variant)
    const board = new HydratedPunctBoard({ pieces: [] })
    for (const spec of pieces) {
        const [code, name, turn] = spec.split(' ')
        const playerId = code[0] === 'W' ? WHITE : BLACK
        const kind = KINDS[code[1]]
        const punct = spaceAt(name)
        const rotation = Number(turn)
        const level = board.levelFor(playerId, kind, punct, rotation)
        if (level === undefined) throw Error(`${spec} cannot rest there`)
        board.move(board.place(playerId, kind, punct, rotation), { punct, rotation, level })
    }
    state.board = { pieces: board.pieces }
    const placed = new HydratedPunctGameState(state)
    for (const player of state.players) {
        for (const kind of Object.values(KINDS)) {
            if (placed.reserveCount(player.playerId, kind) < 0) {
                throw Error(`Too many ${kind} for ${player.playerId}`)
            }
        }
    }
    return { game, state }
}

// A seeded game played forward, favouring moves onto other pieces, for positions with layers.
function playout(seed, steps, variant = 'Standard') {
    const { startedGame: game, initialState } = startedGame(variant)
    let state = initialState
    let random = seed
    const next = () => {
        random = (random * 16807) % 2147483647
        return random / 2147483647
    }
    for (let step = 0; step < steps; step++) {
        const hydrated = new HydratedPunctGameState(state)
        const playerId = state.activePlayerIds[0]
        const base = { id: `s${step}`, gameId: game.id, source: ActionSource.User, playerId }
        const climbs = hydrated.board.movablePieces(playerId).flatMap((piece) =>
            hydrated.board
                .movesOf(piece)
                .filter((move) => move.level > 0)
                .map((move) => ({
                    ...base,
                    type: ActionType.MovePiece,
                    from: piece.punct,
                    to: move.punct,
                    rotation: move.rotation
                }))
        )
        const kinds = hydrated.kindsInReserve(playerId)
        const kind = kinds[Math.floor(next() * kinds.length)]
        // New pieces gather near the middle, where they meet and climb.
        const entries = hydrated
            .entriesOf(playerId, kind)
            .filter((entry) => Math.abs(entry.punct.q) + Math.abs(entry.punct.r) < 7)
        const climb = climbs.length > 0 && next() < 0.55
        const action = climb
            ? climbs[Math.floor(next() * climbs.length)]
            : (() => {
                  const entry = entries[Math.floor(next() * entries.length)]
                  return {
                      ...base,
                      type: ActionType.PlacePiece,
                      kind,
                      punct: entry.punct,
                      rotation: entry.rotation
                  }
              })()
        const result = engine.executeCanonicalAction({ game, state, action })
        if (result.updatedState.machineState !== 'TakingTurn') break
        state = result.updatedState
    }
    // The position, with White to move.
    const fresh = startedGame(variant)
    fresh.initialState.board = { pieces: state.board.pieces }
    return { game: fresh.startedGame, state: fresh.initialState }
}

function piecesLeft(state, playerId) {
    return state
        .kindsInReserve(playerId)
        .reduce((count, kind) => count + state.reserveCount(playerId, kind), 0)
}

// A seeded game played on, pieces moving into the central spaces, until White has one piece
// left to place.
function lastPiece(seed) {
    const { startedGame: game, initialState } = startedGame()
    let state = initialState
    let random = seed
    const next = () => {
        random = (random * 16807) % 2147483647
        return random / 2147483647
    }
    const nearMiddle = ({ q, r }) => Math.abs(q) + Math.abs(r) + Math.abs(q + r)
    for (let step = 0; ; step++) {
        const hydrated = new HydratedPunctGameState(state)
        const playerId = state.activePlayerIds[0]
        if (playerId === WHITE && piecesLeft(hydrated, WHITE) === 1) break
        const base = { id: `s${step}`, gameId: game.id, source: ActionSource.User, playerId }
        const inwards = hydrated.board.movablePieces(playerId).flatMap((piece) =>
            hydrated.board
                .movesOf(piece)
                .filter((move) => nearMiddle(move.punct) <= 6)
                .map((move) => ({
                    ...base,
                    type: ActionType.MovePiece,
                    from: piece.punct,
                    to: move.punct,
                    rotation: move.rotation
                }))
        )
        const kinds = hydrated.kindsInReserve(playerId)
        const kind = kinds[Math.floor(next() * kinds.length)]
        const entries = kind
            ? hydrated.entriesOf(playerId, kind).filter((entry) => nearMiddle(entry.punct) < 18)
            : []
        const move = (inwards.length > 0 && next() < 0.5) || entries.length === 0
        if (move && inwards.length === 0) throw Error(`Seed ${seed} runs out of moves`)
        const action = move
            ? inwards[Math.floor(next() * inwards.length)]
            : (() => {
                  const entry = entries[Math.floor(next() * entries.length)]
                  return {
                      ...base,
                      type: ActionType.PlacePiece,
                      kind,
                      punct: entry.punct,
                      rotation: entry.rotation
                  }
              })()
        const result = engine.executeCanonicalAction({ game, state, action })
        if (result.updatedState.machineState !== 'TakingTurn') {
            throw Error(`Seed ${seed} ends the game at step ${step}`)
        }
        state = result.updatedState
    }
    const fresh = startedGame()
    fresh.initialState.board = { pieces: state.board.pieces }
    return { game: fresh.startedGame, state: fresh.initialState }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

// Pieces on pieces on pieces, and bridges: a game played on with many climbs.
write('layers', 'Layers', playout(20261101, 40))

// A few pieces each, early in a game.
write(
    'opening',
    'Opening',
    position(['WE C4 0', 'BT M12 3', 'WA F9 1', 'BE K5 5', 'WT D11 2', 'BL J13 4'])
)

// Pieces on pieces of their own colour: three-high towers of each colour, and a triangle on two
// straight pieces of each colour, for judging how the levels part.
write(
    'same-colour-stacks',
    'Same-colour stacks',
    position([
        'WE C2 0',
        'WC C3 0',
        'WE C2 0',
        'BE H3 0',
        'BC H4 0',
        'BE H3 0',
        'WE K4 0',
        'WE L4 0',
        'WT K5 2',
        'BE N7 0',
        'BE O7 0',
        'BT N8 2'
    ])
)

// Towers either side of where a straight piece goes in at D6 (the logic's space names): turning it
// from up the board to up and right sweeps over the tower at E8, and the long way round over
// the one at C7, so it lifts clear, turns and comes back down.
write(
    'turning-past-towers',
    'Turning past towers',
    position(['WT E8 0', 'WT E8 0', 'WT E8 0', 'WT C7 3', 'WT C7 3', 'WT C7 3'])
)

// White's chain along row 8 from column A to Q: a bridge at G8–I8 over the gap between a white
// and a black piece, a two-high white stack at J8–L8, and D8–F8 open, where a straight piece
// joins the sides.
write(
    'one-from-a-connection',
    'One from a connection',
    position([
        'WE A8 2',
        'WT G8 3',
        'BE I8 3',
        'WE G8 2',
        'WE J8 2',
        'WC K8 2',
        'WA N8 5',
        'WT P10 2',
        'BT F12 1',
        'BA K4 2',
        'BL N11 0',
        'BE E12 1'
    ])
)

// White's last piece, ahead on the central spaces: placing it anywhere wins on the count.
write('last-piece', 'Last piece', lastPiece(31676))
