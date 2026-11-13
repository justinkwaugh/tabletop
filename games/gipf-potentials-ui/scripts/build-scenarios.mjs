// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    basicsIn,
    Definition,
    discsIn,
    emptyBoard,
    GEOMETRY,
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

// White to move. Each stack lists its units bottom up: B basic, G GIPF-piece, T Z D Y P loaded,
// a * before one a used potential on its own; capitals are White's. Reserves and potentials in
// hand are what the config leaves unless `players` says otherwise. `moved`: past the first turn.
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
        if (!GEOMETRY.isSpot({ q, r })) throw Error(`${name} is not a spot`)
        const stack = units.split(' ').map((code) => {
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
            player.reserve -= basicsIn(unit)
            // Numbered as they would have come in, so each disc lies its own way round.
            const discIds = Array.from({ length: discsIn(unit) }, () => state.nextDiscId++)
            return { ...unit, discIds }
        })
        state.board.stacks.push({ coords: { q, r }, units: stack })
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

write(
    'punct-cover',
    'PÜNCT cover',
    position({ ...WHITE_GIPF, ...BLACK_GIPF, G3: 'P', G4: 'p' }, { config: ONLY('punct') })
)

write(
    'cover-the-last-gipf',
    'Cover the last GIPF',
    position({ ...WHITE_GIPF, H2: 'g', G3: 'P', F4: 'B', E5: 'B' }, { config: ONLY('punct') })
)

write(
    'tamsk-extra-move',
    'TAMSK extra move',
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'B', E3: 'B', E4: 'T' },
        { config: ONLY('tamsk') }
    )
)

write(
    'their-tamsk',
    "Black's TAMSK",
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'B', E3: 'B', E4: 't' },
        { config: ONLY('tamsk') }
    )
)

write(
    'take-a-row',
    'Take a row',
    position(
        { B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'G', E3: 'Y', E4: 'B', E6: 'd', E7: 'b' },
        { config: { yinsh: '6', dvonn: '6' } }
    )
)

write(
    'break-the-four',
    'Break the four',
    position({ B5: 'G', H5: 'G', G2: 'G', ...BLACK_GIPF, E2: 'G', E3: 'Y', E4: 'G' })
)

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

write(
    'last-gipf-piece',
    'Last GIPF piece',
    position(
        { B5: 'G', H5: 'G', G2: 'G', E3: 'B', E4: 'B', E5: 'B', E6: 'g' },
        { config: ONLY('zertz') }
    )
)

write(
    'gipf-piece-out-of-reach',
    'GIPF piece out of reach',
    position(
        { B5: 'G', H5: 'G', G2: 'G', E3: 'B', E4: 'B', E5: 'B', E7: 'g' },
        { config: ONLY('zertz') }
    )
)

write(
    'out-of-moves',
    'Out of moves',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'b', G3: 'b' },
        { config: ONLY('zertz'), players: { [BLACK]: { reserve: 0 } } }
    )
)

write(
    'one-move-left',
    'One move left',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'b', G3: 'z', G4: 'B' },
        { config: ONLY('zertz'), players: { [BLACK]: { reserve: 0 } } }
    )
)
