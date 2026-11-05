// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    emptyBoard,
    GipfPotentialsInfo,
    GipfPotentialsRuntime,
    pointAt,
    potentialsFromConfig,
    VERSION_RULES,
    versionFromConfig
} from '@tabletop/gipf-potentials'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(GipfPotentialsRuntime)
const WHITE = 'player-1'
const BLACK = 'player-2'
const POTENTIALS = { t: 'tamsk', z: 'zertz', d: 'dvonn', y: 'yinsh', p: 'punct' }

/**
 * White to move. Stacks are spot names to units read bottom to top, separated by spaces: B a
 * basic piece, G a GIPF-piece, T, Z, D, Y or P a basic piece loaded with that potential, and *
 * before a potential's letter the potential used, on its own. Capitals are White's, lower case
 * Black's. Each player's reserve and potentials in hand are what the version and config leave
 * after the pieces on the board, unless `players` says otherwise. `moved` marks both players as
 * past their first turn, for Tournament positions.
 */
function position(stacks, { config = {}, players = {}, moved = false } = {}) {
    const game = GipfPotentialsRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'gipf-potentials',
            ownerId: 'owner',
            config: {
                ...defaultGameConfig(GipfPotentialsInfo.configurator?.options ?? []),
                ...config
            },
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
    const pieces = VERSION_RULES[versionFromConfig(startedGame.config)].pieces
    const potentials = potentialsFromConfig(startedGame.config)
    state.board = emptyBoard()
    state.nextDiscId = 0
    for (const player of state.players) {
        player.reserve = pieces
        player.potentials = { ...potentials }
        player.playedOther = true
    }
    for (const [name, units] of Object.entries(stacks)) {
        const { q, r } = pointAt(name)
        const spot = state.board.spots.find((s) => s.coords.q === q && s.coords.r === r)
        if (spot === undefined) throw Error(`${name} is not a spot`)
        spot.stack = units.split(' ').map((code) => {
            const used = code.startsWith('*')
            const letter = used ? code[1] : code[0]
            const playerId = letter === letter.toUpperCase() ? WHITE : BLACK
            const player = state.players.find((p) => p.playerId === playerId)
            const kind = letter.toLowerCase()
            const potential = POTENTIALS[kind]
            if (potential !== undefined) player.potentials[potential] -= 1
            const unit = used
                ? { playerId, kind: potential }
                : kind === 'g'
                  ? { playerId, kind: 'gipf' }
                  : { playerId, kind: 'basic', ...(potential ? { load: potential } : {}) }
            if (!used) player.reserve -= kind === 'g' ? 2 : 1
            const discs = used ? 1 : kind === 'b' ? 1 : 2
            // Numbered as they would have come in, so each disc lies its own way round.
            const discIds = Array.from({ length: discs }, () => state.nextDiscId++)
            return { ...unit, discIds }
        })
    }
    for (const player of state.players) {
        for (const kind of Object.keys(player.potentials)) {
            player.potentials[kind] = Math.max(0, player.potentials[kind])
        }
        Object.assign(player, players[player.playerId] ?? {})
        if (player.reserve < 0) throw Error(`Too many pieces for ${player.playerId}`)
    }
    if (moved) state.turnManager.turnCounts = { [WHITE]: 1, [BLACK]: 1 }
    return { game: startedGame, state }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

const ALL_KINDS = { version: 'Ultimate' }
const ONLY = (kind, count = '6') => ({ yinsh: '0', [kind]: count })

// GIPF-pieces on Standard's corners, and kept clear of the scenes below unless one moves them.
const WHITE_GIPF = { E2: 'G', B5: 'G', H5: 'G' }
const BLACK_GIPF = { E8: 'g', B2: 'g', H2: 'g' }

// Every potential with a move to make: ZÈRTZ on C4 jumps D4 and E4 to F3, DVONN on D6 covers
// Black's piece on E6, PÜNCT on G3 covers Black's GIPF-piece on H2, YINSH on E3 slides, and
// TAMSK on C5 has no move of its own.
write(
    'potentials',
    'Potentials',
    position(
        {
            ...WHITE_GIPF,
            ...BLACK_GIPF,
            C4: 'Z',
            D4: 'b',
            E4: 'b',
            D6: 'D',
            E6: 'b',
            G3: 'P',
            E3: 'Y',
            C5: 'T'
        },
        { config: ALL_KINDS, moved: true }
    )
)

// What DVONN on D6 may cover: Black's plain pieces on E6 and E7 and Black's DVONN on White's
// piece on D5, not Black's GIPF-piece on C6 or TAMSK-loaded piece on D7.
write(
    'dvonn-targets',
    'DVONN targets',
    position(
        {
            ...WHITE_GIPF,
            ...BLACK_GIPF,
            D6: 'D',
            E6: 'b',
            D5: 'B *d',
            C6: 'g',
            D7: 't',
            E7: 'b'
        },
        { config: { ...ONLY('dvonn', '4'), tamsk: '4' } }
    )
)

// PÜNCT on G3 covers Black's GIPF-piece on H2 with one piece from the reserve or two, or Black's
// PÜNCT-loaded piece on G4.
write(
    'punct-cover',
    'PÜNCT cover',
    position({ ...WHITE_GIPF, ...BLACK_GIPF, G3: 'P', G4: 'p' }, { config: ONLY('punct') })
)

// Black's last GIPF-piece stands on H2, beside White's PÜNCT on G3: covering it wins at the end
// of the turn. Covered with one piece, that piece completes White's row E5–H2 and must go with
// it, so Black's GIPF-piece is free again and play goes on; covered with two, the new
// GIPF-piece may stay, and White wins.
write(
    'cover-the-last-gipf',
    'Cover the last GIPF',
    position({ ...WHITE_GIPF, H2: 'g', G3: 'P', F4: 'B', E5: 'B' }, { config: ONLY('punct') })
)

// A push from E1 moves E2–E4 up a spot, putting White's TAMSK-loaded piece on the centre, E5,
// and lining up E2–E5. White's extra move comes first (or Skip, which loses the potential); the
// row is taken after it.
write(
    'tamsk-extra-move',
    'TAMSK extra move',
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'B', E3: 'B', E4: 'T' },
        { config: ONLY('tamsk') }
    )
)

// The same push puts Black's TAMSK-loaded piece on the centre: Black's turn opens with the extra
// move.
write(
    'their-tamsk',
    "Black's TAMSK",
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'B', E3: 'B', E4: 't' },
        { config: ONLY('tamsk') }
    )
)

// A push from E1 onto E2 completes White's row E2–E5, reaching over Black's DVONN-loaded piece on
// E6 and plain piece on E7. Plain pieces go; GIPF-pieces and loaded pieces may stay, White's
// starting left and Black's marked for removal, each tapped to switch.
write(
    'take-a-row',
    'Take a row',
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'G', E3: 'Y', E4: 'B', E6: 'd', E7: 'b' },
        { config: { yinsh: '6', dvonn: '6' } }
    )
)

// A push from E1 with a loaded piece makes E2–E5 a four of GIPF-pieces and loaded pieces: it
// must be broken, so Take row waits until one of them is marked for removal.
write(
    'break-the-four',
    'Break the four',
    position({ B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'G', E3: 'Y', E4: 'G' })
)

// Tournament: White still brings in GIPF-pieces. Pushing one in from E1 makes E2–E5 a row of
// GIPF-pieces alone, which White may take or leave standing.
write(
    'gipf-row',
    'Row of GIPF-pieces',
    position(
        { ...BLACK_GIPF, E2: 'G', E3: 'G', E4: 'G' },
        {
            config: { version: 'Tournament' },
            moved: true,
            players: { [WHITE]: { playedOther: false } }
        }
    )
)

// Taking White's row E2–E5 after a push from E1 captures Black's DVONN on E6, freeing White's
// piece under it, which completes a second row, E6–H3: White takes that one too.
write(
    'uncovered-row',
    'Uncovered row',
    position(
        {
            B5: 'G',
            H5: 'G',
            G2: 'G',
            ...BLACK_GIPF,
            E2: 'B',
            E3: 'B',
            E4: 'B',
            E6: 'B *d',
            F5: 'B',
            G4: 'B',
            H3: 'B'
        },
        { config: { dvonn: '6' } }
    )
)

// Black's last GIPF-piece stands on E6, in the reach of the row a push from E1 completes: White
// wins by taking it.
write(
    'last-gipf-piece',
    'Last GIPF piece',
    position(
        { B5: 'G', H5: 'G', G2: 'G', E3: 'B', E4: 'B', E5: 'B', E6: 'g' },
        { config: ONLY('zertz') }
    )
)

// Near miss: Black's last GIPF-piece stands on E7, past the empty E6, out of the row's reach.
write(
    'gipf-piece-out-of-reach',
    'GIPF piece out of reach',
    position(
        { B5: 'G', H5: 'G', G2: 'G', E3: 'B', E4: 'B', E5: 'B', E7: 'g' },
        { config: ONLY('zertz') }
    )
)

// Black has no piece in reserve and no potential on the board: whatever White plays, Black
// cannot move and loses.
write(
    'out-of-moves',
    'Out of moves',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'b', G3: 'b' },
        { config: ONLY('zertz'), players: { [BLACK]: { reserve: 0 } } }
    )
)

// Near miss: Black's ZÈRTZ-loaded piece on G3 can still jump White's piece on G4, so Black plays
// on.
write(
    'one-move-left',
    'One move left',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'b', G3: 'z', G4: 'B' },
        { config: ONLY('zertz'), players: { [BLACK]: { reserve: 0 } } }
    )
)
