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
    return engine.startGame(game, { startingPositions: { playerIds: [WHITE, BLACK] } })
}

/**
 * White to move. Pieces are listed in the order they came to rest, each as
 * `<owner><kind> <PÜNCT space> <rotation>`: W or B, then T triangle, E straight with its PÜNCT
 * at an end, C straight with it in the centre, A angular with it at the corner, L or R angular
 * with it at an end, turning left or right. Each comes to rest where the rules put it, on the
 * board or on the pieces before it; reserves hold the rest unless `reserves` says otherwise.
 */
function position(pieces, { variant = 'Standard', reserves = {} } = {}) {
    const { startedGame: game, initialState: state } = startedGame(variant)
    const board = new HydratedPunctBoard({ pieces: [] })
    for (const spec of pieces) {
        const [code, name, rotation] = spec.split(' ')
        const playerId = code[0] === 'W' ? WHITE : BLACK
        const kind = KINDS[code[1]]
        const punct = spaceAt(name)
        const level = board.levelFor(playerId, kind, punct, Number(rotation))
        if (level === undefined) throw Error(`${spec} cannot rest there`)
        board.place({
            id: board.pieces.length,
            playerId,
            kind,
            punct,
            rotation: Number(rotation),
            level
        })
        const player = state.players.find((p) => p.playerId === playerId)
        player.reserve[kind] -= 1
        if (player.reserve[kind] < 0) throw Error(`Too many ${kind} for ${playerId}`)
    }
    for (const player of state.players) {
        Object.assign(player.reserve, reserves[player.playerId] ?? {})
    }
    state.board = { pieces: board.pieces }
    state.nextPieceId = board.pieces.length
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
        const player = hydrated.getPlayerState(playerId)
        const kinds = player.kindsInReserve()
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
    const board = new HydratedPunctBoard(state.board)
    const pieces = board.pieces.map((piece, id) => ({ ...piece, id }))
    for (const player of fresh.initialState.players) {
        player.reserve = { ...state.players.find((p) => p.playerId === player.playerId).reserve }
    }
    fresh.initialState.board = { pieces }
    fresh.initialState.nextPieceId = pieces.length
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
