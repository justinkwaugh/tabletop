// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { Definition, MatrxInfo, MatrxRuntime, pointAt } from '@tabletop/matrx'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(MatrxRuntime)
const WHITE = 'player-1'
const BLACK = 'player-2'
const KINDS = { g: 'gipf', t: 'tamsk', z: 'zertz', d: 'dvonn', y: 'yinsh', p: 'punct' }
const POTENTIALS = ['tamsk', 'zertz', 'dvonn', 'yinsh', 'punct']

/**
 * White to move. Stacks are point names to units read bottom to top, separated by spaces: a
 * letter for the kind (G GIPF, T TAMSK, Z ZÈRTZ, D DVONN, Y YINSH, P PÜNCT), a capital for
 * White's and lower case for Black's, and a 2 after a potential for an unused stack of two.
 * Each player's reserve holds what is not on the board, unless `reserves` says otherwise.
 */
function position(stacks, { board = 'Matrx', reserves = {} } = {}) {
    const game = MatrxRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'matrx',
            ownerId: 'owner',
            config: { ...defaultGameConfig(MatrxInfo.configurator?.options ?? []), board },
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
    for (const [name, units] of Object.entries(stacks)) {
        const { q, r } = pointAt(name)
        const spot = state.board.spots.find((s) => s.coords.q === q && s.coords.r === r)
        if (spot === undefined) throw Error(`${name} is not a spot`)
        spot.stack = units.split(' ').map((code) => {
            const letter = code[0]
            const playerId = letter === letter.toUpperCase() ? WHITE : BLACK
            const kind = KINDS[letter.toLowerCase()]
            const paired = code.endsWith('2')
            const player = state.players.find((p) => p.playerId === playerId)
            if (kind === 'gipf') player.gipfPieces -= 1
            else player.potentials[kind] -= paired ? 2 : 1
            // Numbered as they would have come in, so each disc lies its own way round.
            const discIds = Array.from({ length: paired ? 2 : 1 }, () => state.nextDiscId++)
            return { playerId, kind, paired, discIds }
        })
    }
    for (const player of state.players) {
        Object.assign(player, reserves[player.playerId] ?? {})
        for (const kind of POTENTIALS) {
            if (player.potentials[kind] < 0) throw Error(`Too many ${kind} for ${player.playerId}`)
        }
    }
    return { game: startedGame, state }
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

const WHITE_GIPF = { B2: 'G', D2: 'G', F2: 'G' }
const BLACK_GIPF = { B5: 'g', D7: 'g', H5: 'g' }

// Each potential with a move to make: ZÈRTZ on C4 jumps D4 and E4 to F3, DVONN on D6 covers
// Black's DVONN stack on G4, PÜNCT on H2 covers Black's PÜNCT stack on F4, YINSH on E3 slides,
// and TAMSK on C5 has no move of its own.
write(
    'potentials',
    'Potentials',
    position({
        ...WHITE_GIPF,
        ...BLACK_GIPF,
        C4: 'Z2',
        D4: 'y',
        E4: 'p',
        D6: 'D2',
        G4: 'd2',
        H2: 'P2',
        F4: 'p2',
        E3: 'Y2',
        C5: 'T2'
    })
)

// A push from E1 moves E2–E4 up a spot and puts White's TAMSK stack on the centre, E5: an extra
// move with its top piece, before the row E4–E7 is taken.
write(
    'tamsk-extra-move',
    'TAMSK extra move',
    position({
        ...WHITE_GIPF,
        ...BLACK_GIPF,
        E2: 'y',
        E3: 'Y',
        E4: 'T2',
        E6: 'Y',
        E7: 'Y',
        G3: 'z2'
    })
)

// The same push puts Black's TAMSK stack on the centre: Black's turn opens with the extra move.
write(
    'their-tamsk',
    "Black's TAMSK",
    position({
        ...WHITE_GIPF,
        ...BLACK_GIPF,
        E2: 'Y',
        E3: 'Y',
        E4: 't2',
        G3: 'z2'
    })
)

// A push from E1 onto E2 completes White's row E2–E5; its reach runs on over Black's stack on E6
// and single on E7. Singles go; every stack of two may stay, but the row must be broken.
write(
    'take-a-row',
    'Take a row',
    position({
        ...WHITE_GIPF,
        ...BLACK_GIPF,
        E3: 'Y2',
        E4: 'D',
        E5: 'P',
        E6: 'z2',
        E7: 'y'
    })
)

// White's row E2–E5 reaches E6, where Black's DVONN piece covers White's DVONN stack. Taking the
// row captures it, uncovering the stack, which completes a second white row, D6–G4.
write(
    'uncovered-row',
    'Uncovered row',
    position({
        ...WHITE_GIPF,
        ...BLACK_GIPF,
        E3: 'Y',
        E4: 'Y',
        E5: 'Y',
        E6: 'D2 d',
        D6: 'Z',
        F5: 'Z',
        G4: 'Z'
    })
)

// Black has one GIPF piece left, on E6, in the reach of White's row E2–E5: White wins by taking
// the row.
write(
    'last-gipf-piece',
    'Last GIPF piece',
    position(
        { ...WHITE_GIPF, E3: 'Y', E4: 'Y', E5: 'Y', E6: 'g' },
        { reserves: { [BLACK]: { gipfPieces: 0 } } }
    )
)

// Near miss: Black's last GIPF piece stands on E7, past the empty E6, out of the row's reach.
write(
    'gipf-piece-out-of-reach',
    'GIPF piece out of reach',
    position(
        { ...WHITE_GIPF, E3: 'Y', E4: 'Y', E5: 'Y', E7: 'g' },
        { reserves: { [BLACK]: { gipfPieces: 0 } } }
    )
)

const NOTHING = { tamsk: 0, zertz: 0, dvonn: 0, yinsh: 1, punct: 1 }

// Black has no stack left to bring in and no stack of two on the board: whatever White plays,
// Black cannot move and loses.
write(
    'out-of-moves',
    'Out of moves',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'y', G3: 'z' },
        { reserves: { [BLACK]: { potentials: NOTHING } } }
    )
)

// Near miss: Black's YINSH stack on G3 can still slide, so Black plays on.
write(
    'one-move-left',
    'One move left',
    position(
        { ...WHITE_GIPF, ...BLACK_GIPF, C4: 'y', G3: 'y2' },
        { reserves: { [BLACK]: { potentials: NOTHING } } }
    )
)

// The game on GIPF's own 37-spot board.
write(
    'gipf-board',
    'On the GIPF board',
    position(
        {
            B2: 'G',
            D2: 'G',
            F2: 'G',
            B5: 'g',
            D7: 'g',
            H5: 'g',
            C4: 'Z2',
            D4: 'y',
            E3: 'Y2',
            F4: 'p2',
            H2: 'P2'
        },
        { board: 'Gipf' }
    )
)
