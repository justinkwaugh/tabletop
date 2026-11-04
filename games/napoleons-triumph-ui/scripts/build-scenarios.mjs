// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenarioJson } from '@tabletop/common'
import { startingPosition, startingPositionFile } from '@tabletop/common/testing'
import { AUSTERLITZ, ActionType, CommandKind, Side } from '@tabletop/napoleons-triumph'
import {
    TestGame,
    arrangeBattlefield,
    artillery,
    cavalry,
    infantry,
    passTurns
} from '@tabletop/napoleons-triumph/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

const ST_HILAIRE = 93
const WIDE_INTO = 94
const FLANK = 83
const FLAT_FROM = 72
const FLAT_INTO = 74
const HILL_FROM = 25
const HILL_INTO = 38

const french = (id, face, locale, more = {}) => ({ id, side: Side.French, face, locale, ...more })
const allied = (id, face, locale, more = {}) => ({ id, side: Side.Allied, face, locale, ...more })

function alliedCorps(commanderId, locale, ids, more = {}) {
    return ids.map((id, i) =>
        allied(id, infantry(i === 0 ? 3 : 2), locale, { commanderId, ...more })
    )
}

/** A French turn, in the first round or a later one, with only the pieces placed on the map. */
function frenchTurn(placements, { round = 1 } = {}) {
    const game = new TestGame()
    game.deployBoth()
    passTurns(game, 1 + 2 * (round - 1))
    arrangeBattlefield(game, placements)
    return game
}

function write(slug, name, game) {
    const file = startingPositionFile({
        slug,
        name,
        game: {
            ...game.game,
            players: game.game.players.map((player, i) => ({ ...player, name: `Player ${i + 1}` }))
        },
        state: game.state
    })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

const approach = (from, into) => AUSTERLITZ.approachBetween(from, into).id

/** A French turn with only the pieces placed, played on by `play`, kept with the actions it took. */
function writePlayed(slug, name, placements, play) {
    const arranged = frenchTurn(placements)
    const start = startingPosition({
        slug,
        name,
        game: {
            ...arranged.game,
            players: arranged.game.players.map((player, i) => ({
                ...player,
                name: `Player ${i + 1}`
            }))
        },
        state: arranged.state
    })
    const game = new TestGame()
    game.game = start.game
    game.state = start.state
    const actions = []
    play((side, type, payload) => actions.push(...game.act(type, game.playerOf(side), payload)))
    writeFileSync(
        join(OUT, `${slug}.json`),
        scenarioJson({
            game: { ...start.game, activePlayerIds: [...game.state.activePlayerIds] },
            state: game.state,
            actions
        })
    )
}

mkdirSync(OUT, { recursive: true })

write(
    'artillery-pair-detached-on-a-wide-approach',
    'Artillery pair, detached, wide approach',
    frenchTurn([
        french('F01', artillery(), ST_HILAIRE, { facing: WIDE_INTO }),
        french('F02', artillery(), ST_HILAIRE, { facing: WIDE_INTO }),
        ...alliedCorps('prebyshevsky', WIDE_INTO, ['A01', 'A02', 'A03'])
    ])
)

write(
    'artillery-pair-in-a-corps-on-a-wide-approach',
    'Artillery pair in a corps with another unit, wide approach',
    frenchTurn([
        french('F01', artillery(), ST_HILAIRE, { facing: WIDE_INTO, commanderId: 'st-hilaire' }),
        french('F02', artillery(), ST_HILAIRE, { facing: WIDE_INTO, commanderId: 'st-hilaire' }),
        french('F03', infantry(3), ST_HILAIRE, { facing: WIDE_INTO, commanderId: 'st-hilaire' }),
        ...alliedCorps('prebyshevsky', WIDE_INTO, ['A01', 'A02', 'A03'])
    ])
)

write(
    'artillery-pair-alone-in-a-corps-on-a-wide-approach',
    'Artillery pair alone in a corps, wide approach',
    frenchTurn([
        french('F01', artillery(), ST_HILAIRE, { facing: WIDE_INTO, commanderId: 'st-hilaire' }),
        french('F02', artillery(), ST_HILAIRE, { facing: WIDE_INTO, commanderId: 'st-hilaire' }),
        ...alliedCorps('prebyshevsky', WIDE_INTO, ['A01', 'A02', 'A03'])
    ])
)

write(
    'artillery-pair-on-a-narrow-approach',
    'Artillery pair, detached, narrow approach',
    frenchTurn([
        french('F01', artillery(), FLAT_FROM, { facing: FLAT_INTO }),
        french('F02', artillery(), FLAT_FROM, { facing: FLAT_INTO }),
        ...alliedCorps('miloradovich', FLAT_INTO, ['A01', 'A02', 'A03'])
    ])
)

write(
    'bombardment-then-assault-across-one-approach',
    'Bombardment, then an assault across the same approach',
    frenchTurn([
        french('F01', artillery(), FLAT_FROM, { facing: FLAT_INTO }),
        french('F02', artillery(), FLAT_FROM, { facing: FLAT_INTO }),
        french('F03', infantry(3), FLAT_FROM, { commanderId: 'vandamme' }),
        french('F04', infantry(3), FLAT_FROM, { commanderId: 'vandamme' }),
        french('F05', infantry(2), FLAT_FROM, { commanderId: 'vandamme' }),
        ...alliedCorps('miloradovich', FLAT_INTO, ['A01', 'A02', 'A03'])
    ])
)

const firedLastRound = (game, from, into) =>
    game.arrange((state) => {
        state.playerOf(Side.French).artilleryFire = {
            [String(approach(from, into))]: state.round - 1
        }
    })

const flatGuns = frenchTurn(
    [
        french('F01', artillery(), FLAT_FROM, { facing: FLAT_INTO }),
        french('F03', infantry(3), FLAT_FROM, { commanderId: 'vandamme' }),
        ...alliedCorps('miloradovich', FLAT_INTO, ['A01', 'A02', 'A03'])
    ],
    { round: 2 }
)
firedLastRound(flatGuns, FLAT_FROM, FLAT_INTO)
write('guns-that-fired-last-round', 'Guns that fired across this approach last round', flatGuns)

const hillGuns = frenchTurn(
    [
        french('F01', artillery(), HILL_FROM, { facing: HILL_INTO }),
        french('F03', infantry(3), HILL_FROM, { commanderId: 'vandamme' }),
        ...alliedCorps('miloradovich', HILL_INTO, ['A01', 'A02', 'A03'])
    ],
    { round: 2 }
)
firedLastRound(hillGuns, HILL_FROM, HILL_INTO)
write(
    'guns-that-fired-last-round-from-a-hill',
    'Guns that fired last round, down from a hill',
    hillGuns
)

const CENTRE = 83
const crowded = frenchTurn(
    [
        french('F01', artillery(), CENTRE, { facing: FLAT_INTO }),
        french('F02', artillery(), CENTRE, { facing: FLAT_INTO }),
        french('F03', artillery(), CENTRE, { facing: FLAT_FROM }),
        french('F04', infantry(3), CENTRE, { commanderId: 'st-hilaire', facing: WIDE_INTO }),
        french('F05', artillery(), CENTRE, { commanderId: 'st-hilaire', facing: WIDE_INTO }),
        french('F06', infantry(3), CENTRE, { commanderId: 'vandamme' }),
        french('F07', infantry(2), CENTRE, { commanderId: 'vandamme' }),
        french('F08', infantry(3), CENTRE, { commanderId: 'legrand', facing: 95 }),
        allied('A01', artillery(), FLAT_INTO, { facing: CENTRE }),
        ...alliedCorps('miloradovich', FLAT_INTO, ['A02', 'A03']),
        allied('A04', artillery(), FLAT_FROM, { facing: CENTRE }),
        ...alliedCorps('kollowrath', FLAT_FROM, ['A05', 'A06']),
        ...alliedCorps('prebyshevsky', WIDE_INTO, ['A07', 'A08', 'A09']),
        ...alliedCorps('langeron', 95, ['A10', 'A11'])
    ],
    { round: 3 }
)
crowded.arrange((state) => {
    const fired = (from, into, roundsAgo) => [String(approach(from, into)), state.round - roundsAgo]
    state.playerOf(Side.French).artilleryFire = Object.fromEntries([
        fired(CENTRE, FLAT_INTO, 1),
        fired(CENTRE, FLAT_FROM, 0),
        fired(CENTRE, WIDE_INTO, 1)
    ])
    state.limits.bombardedApproaches = [approach(CENTRE, FLAT_FROM)]
    state.playerOf(Side.Allied).artilleryFire = Object.fromEntries([
        fired(FLAT_INTO, CENTRE, 1),
        fired(FLAT_FROM, CENTRE, 1)
    ])
})
write('guns-resting-on-a-crowded-front', 'Guns resting on a crowded front', crowded)

write(
    'second-attack-after-a-repulse-or-feint',
    'A second attack after a repulse or a feint',
    frenchTurn([
        french('F01', infantry(2), ST_HILAIRE, { commanderId: 'st-hilaire' }),
        french('F02', infantry(2), ST_HILAIRE, { commanderId: 'st-hilaire' }),
        french('F03', infantry(3), ST_HILAIRE, { commanderId: 'vandamme' }),
        french('F04', infantry(2), ST_HILAIRE, { commanderId: 'vandamme' }),
        french('F05', infantry(3), FLANK, { commanderId: 'legrand' }),
        french('F06', infantry(2), FLANK, { commanderId: 'legrand' }),
        ...alliedCorps('prebyshevsky', WIDE_INTO, ['A01', 'A02', 'A03'], { facing: ST_HILAIRE })
    ])
)

write(
    'objective-stars-held',
    'Objective stars held',
    frenchTurn(
        [
            french('F01', infantry(3), 126, { commanderId: 'lannes' }),
            french('F02', infantry(2), 126, { commanderId: 'lannes' }),
            french('F03', cavalry(3), 128, { commanderId: 'murat' }),
            french('F04', cavalry(2), 128, { commanderId: 'murat' }),
            ...alliedCorps('bagration', 62, ['A01', 'A02'])
        ],
        { round: 4 }
    )
)

// Murat can ride by road from 52 through 53 into 63, which Bagration's screen may give up, and end the turn still riding.
write(
    'cavalry-still-riding-at-the-end-of-the-turn',
    'Cavalry still riding at the end of the turn',
    frenchTurn([
        french('F01', cavalry(3), 52, { commanderId: 'murat' }),
        french('F02', cavalry(2), 52, { commanderId: 'murat' }),
        allied('A01', cavalry(2), 63)
    ])
)

const bigBattle = [
    french('F01', infantry(3), ST_HILAIRE, { commanderId: 'st-hilaire', facing: WIDE_INTO }),
    french('F02', infantry(3), ST_HILAIRE, { commanderId: 'st-hilaire', facing: WIDE_INTO }),
    french('F03', infantry(2), ST_HILAIRE, { commanderId: 'st-hilaire' }),
    french('F04', cavalry(2), ST_HILAIRE, { commanderId: 'st-hilaire' }),
    french('F05', infantry(3), ST_HILAIRE, { commanderId: 'vandamme' }),
    allied('A01', infantry(2), WIDE_INTO, { commanderId: 'prebyshevsky', facing: ST_HILAIRE }),
    allied('A02', infantry(1), WIDE_INTO, { commanderId: 'prebyshevsky', facing: ST_HILAIRE }),
    allied('A03', infantry(2), WIDE_INTO, { commanderId: 'langeron', facing: 105 }),
    allied('A04', infantry(1), WIDE_INTO, { commanderId: 'langeron', facing: 105 }),
    allied('A05', infantry(1), WIDE_INTO, { commanderId: 'prebyshevsky' }),
    allied('A06', infantry(2), WIDE_INTO, { commanderId: 'prebyshevsky' }),
    allied('A07', artillery(), WIDE_INTO, { commanderId: 'prebyshevsky' })
]

// The blockers of 93 into 94 are destroyed in the fight, leaving the Allies to retreat.
function foughtToTheRetreat(act) {
    act(Side.French, ActionType.ThreatenAttack, { approach: approach(ST_HILAIRE, WIDE_INTO) })
    act(Side.French, ActionType.PressAttack)
    act(Side.Allied, ActionType.LeadDefense, { leaderIds: ['A01'] })
    act(Side.French, ActionType.DeclareAttack, {
        orders: [
            {
                kind: CommandKind.Corps,
                commanderId: 'st-hilaire',
                unitIds: ['F01', 'F02', 'F03', 'F04']
            }
        ],
        wide: true,
        leaderIds: ['F01', 'F02']
    })
    act(Side.Allied, ActionType.CounterAttack, { unitIds: [] })
}

writePlayed('big-battle-at-the-retreat', 'Big battle at the retreat', bigBattle, foughtToTheRetreat)

writePlayed('big-battle-after-the-retreat', 'Big battle after the retreat', bigBattle, (act) => {
    foughtToTheRetreat(act)
    act(Side.Allied, ActionType.Retreat, {
        losses: { A03: 2, A05: 1, A06: 1 },
        destinations: { A04: 105, A06: 107, A07: 83 },
        kept: {}
    })
})

writePlayed(
    'retreat-before-combat-with-retreat-losses',
    'Retreat before combat with retreat losses',
    [
        french('F01', infantry(3), ST_HILAIRE, { commanderId: 'st-hilaire', facing: WIDE_INTO }),
        french('F02', infantry(3), ST_HILAIRE, { commanderId: 'st-hilaire' }),
        french('F03', cavalry(2), ST_HILAIRE, { commanderId: 'st-hilaire' }),
        allied('A01', infantry(3), WIDE_INTO, { commanderId: 'prebyshevsky' }),
        allied('A02', infantry(2), WIDE_INTO, { commanderId: 'prebyshevsky' }),
        allied('A03', infantry(2), WIDE_INTO, { commanderId: 'langeron', facing: 105 }),
        allied('A04', infantry(1), WIDE_INTO, { commanderId: 'langeron', facing: 105 }),
        allied('A05', infantry(2), WIDE_INTO, { commanderId: 'prebyshevsky' }),
        allied('A06', infantry(1), WIDE_INTO, { commanderId: 'prebyshevsky' }),
        allied('A07', artillery(), WIDE_INTO, { commanderId: 'prebyshevsky' })
    ],
    (act) => {
        act(Side.French, ActionType.ThreatenAttack, { approach: approach(ST_HILAIRE, WIDE_INTO) })
        act(Side.Allied, ActionType.Retreat, {
            losses: { A01: 1, A03: 1, A04: 1, A06: 1 },
            destinations: { A01: 83, A02: 83, A03: 105, A05: 106, A07: 106 },
            kept: { prebyshevsky: 'A01' }
        })
    }
)

console.log(`Scenarios written to ${OUT}`)
