// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    HydratedTzaarGameState,
    MachineState,
    PIECE_KINDS,
    PIECES_OF_KIND,
    SPACES,
    spaceName,
    TzaarInfo,
    TzaarRuntime
} from '@tabletop/tzaar'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(TzaarRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'
const KINDS = { r: 'tzaar', a: 'tzarra', t: 'tott' }

function newGame(version, seed = 1) {
    const game = TzaarRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'tzaar',
            ownerId: 'owner',
            seed,
            config: { ...defaultGameConfig(TzaarInfo.configurator?.options ?? []), version },
            players: [FIRST, SECOND].map((id, index) => ({
                id,
                name: index === 0 ? 'Alice' : 'Bob',
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    return engine.startGame(game, { startingPositions: { playerIds: [FIRST, SECOND] } })
}

/**
 * Alice (White) to make the first capture of her turn. Stacks are space names to pieces read
 * bottom to top: R a Tzaar, A a Tzarra, T a Tott; capitals are Alice's, lower case Bob's. Every
 * other space is empty.
 */
function position(stacks) {
    const { startedGame: game, initialState: state } = newGame('Fixed')
    let id = 0
    for (const space of state.board.spaces) {
        space.stack = (stacks[spaceName(space.coords)] ?? '').split('').map((letter) => ({
            id: id++,
            playerId: letter === letter.toUpperCase() ? FIRST : SECOND,
            kind: KINDS[letter.toLowerCase()]
        }))
    }
    const hydrated = new HydratedTzaarGameState(state)
    for (const player of state.players) {
        for (const kind of PIECE_KINDS) {
            const count = hydrated.board
                .piecesOf(player.playerId)
                .filter((piece) => piece.kind === kind).length
            if (count > PIECES_OF_KIND[kind]) throw Error(`Too many ${kind}s`)
        }
        if (hydrated.missingKind(player.playerId)) throw Error('A type is missing')
    }
    if (!hydrated.canCapture(FIRST)) throw Error('Alice cannot capture')
    return { game, state }
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

function seeded(seed) {
    let value = seed
    return () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
}

function act(game, state, action) {
    return engine.executeCanonicalAction({
        game,
        state,
        action: { id: `a${state.actionCount}`, gameId: game.id, source: 'user', ...action }
    }).updatedState
}

// Seeded play from a random start: captures with the tallest stack it can, and on a second move
// stacks more often than not, so heights build up as they do between careful players. Stops at
// the start of one of Alice's turns.
function midgame({ seed, turns }) {
    const { startedGame: game, initialState } = newGame('Random', seed)
    let state = initialState
    const random = seeded(seed)
    const pick = (options) => options[Math.floor(random() ** 2 * options.length)]
    let turn = 0
    while (
        turn < turns ||
        state.machineState !== MachineState.Capturing ||
        state.activePlayerIds[0] !== FIRST
    ) {
        const hydrated = new HydratedTzaarGameState(state)
        const [playerId] = state.activePlayerIds
        const height = ({ from }) => hydrated.board.heightAt(from)
        const captures = hydrated.captures(playerId).sort((a, b) => height(b) - height(a))
        const stackings = hydrated.stackings(playerId)
        if (state.machineState === MachineState.Capturing) {
            turn += 1
            state = act(game, state, { type: 'capture', playerId, ...pick(captures) })
        } else if (stackings.length > 0 && random() < 0.6) {
            state = act(game, state, { type: 'stack', playerId, ...pick(stackings) })
        } else if (captures.length > 0) {
            state = act(game, state, { type: 'capture', playerId, ...pick(captures) })
        } else {
            state = act(game, state, { type: 'pass', playerId })
        }
        if (state.machineState === MachineState.EndOfGame) throw Error('The midgame ended')
    }
    return { game, state }
}

write('midgame', 'Midgame', midgame({ seed: 11, turns: 14 }))

// Rule G: Bob has two Tzaars on top, D2 and F2, and one buried under a Tott on G3, which does not
// count. Capturing one leaves the game going; capturing the other with the second move wins.
write(
    'two-tzaars-left',
    'Two Tzaars left',
    position({
        D1: 'AA',
        D2: 'r',
        F1: 'TT',
        F2: 'r',
        G3: 'rt',
        H5: 'a',
        B5: 't',
        E8: 'R'
    })
)

// Rule G: Bob has only single pieces, and Alice only stacks but for the Tott on C3. She captures
// C4 with it; stacking it onto A2 then leaves Bob nothing to capture, and she wins. Passing
// instead leaves it on C4, where Bob's B4 and G6 can take it.
write(
    'bob-cannot-capture',
    'Bob cannot capture',
    position({
        C3: 'T',
        C4: 't',
        B4: 'a',
        A2: 'TT',
        E8: 'RR',
        I3: 'AA',
        G6: 'r',
        H5: 'a',
        H2: 't'
    })
)

// Agreed reading: Alice's capture A1 onto A2 leaves her one of each type and nothing to capture,
// so she has no second move and the turn passes to Bob straight away.
write(
    'no-second-move',
    'No second move',
    position({
        A1: 'T',
        A2: 't',
        C1: 'R',
        D1: 'A',
        I5: 'rr',
        I4: 'aa',
        I3: 'tt'
    })
)

// Agreed reading: once Alice captures A3 onto A5 she has one Tzaar (A1) and one Tzarra (A5) on
// top, and no stack may cover either. The stacks offered are A1 onto A2 or B1, and A5 onto A2.
write(
    'covering-a-type',
    'Covering a type',
    position({
        A1: 'R',
        A2: 'T',
        A3: 'A',
        A5: 't',
        B1: 'T',
        C2: 't',
        G7: 'r',
        H6: 'a',
        I5: 't'
    })
)

// Stacks past the full height of 5 thin out between their bottom and top pieces. Alice captures
// F2 with F1, then stacks D2 onto the 9-stack on D3, making 11. Bob's 11-stack on C4 stands
// behind it.
write(
    'tall-stacks',
    'Tall stacks',
    position({
        D3: 'TTTTTTTTA',
        D2: 'TA',
        F1: 'TTT',
        F2: 'tt',
        C4: 'ttttttttttr',
        E5: 'aaaa',
        H3: 't',
        I1: 'R',
        I2: 'T'
    })
)

// Stacks of two to four on neighbouring spaces in both colours, to judge how stacks and their
// counts read where they crowd each other.
write(
    'crowded-stacks',
    'Crowded stacks',
    position({
        A1: 'TTA',
        A2: 'ttr',
        A3: 'TR',
        A4: 'tta',
        B1: 'ta',
        B2: 'TTTA',
        B3: 'ta',
        B4: 'TT',
        C1: 'TA',
        C2: 'tr',
        C3: 'TTR',
        C4: 'at',
        D1: 'tta',
        D2: 'TTA',
        D3: 'tta',
        D4: 'TR',
        E1: 'TA',
        E2: 'ttr',
        E3: 'at'
    })
)

// Stacks of two to nine on the top space of each column, where they rise over the column's
// coordinate label.
write(
    'stacks-by-the-labels',
    'Stacks by the labels',
    position({
        A5: 'TAT',
        B6: 'tt',
        C7: 'TTTTTR',
        D8: 'ttttt',
        E8: 'TTTTTTTTA',
        F8: 'tttttttr',
        G7: 'AAAR',
        H6: 'aaa',
        I5: 'aaaar'
    })
)

// Stacks of two to nine, each with single pieces behind it: straight behind, up its column, in
// the other colour, and behind to either side, to judge how much of a piece a stack in front
// hides.
write(
    'behind-stacks',
    'Behind stacks',
    position({
        A1: 'AT',
        C2: 'tta',
        E2: 'TTTR',
        G2: 'tttta',
        I1: 'TTTTTA',
        A4: 'ttttaar',
        C5: 'TTTTTTAR',
        E6: 'ttttaaaar',
        A2: 'r',
        C3: 'A',
        E3: 'r',
        G3: 'R',
        I2: 'a',
        A5: 'A',
        C6: 'r',
        E7: 'R',
        B2: 'r',
        D3: 'A',
        D2: 't',
        F2: 'R',
        F3: 'A',
        H2: 'R',
        B5: 'A',
        D6: 'A'
    })
)

// Rule I: in the tournament version two spaces are left; Alice places one, Bob the last, and then
// Alice makes the opening capture.
function placementEnds() {
    const { startedGame: game, initialState } = newGame('Tournament')
    let state = initialState
    const left = { [FIRST]: [], [SECOND]: [] }
    for (const playerId of [FIRST, SECOND]) {
        for (const kind of PIECE_KINDS) {
            for (let count = 0; count < PIECES_OF_KIND[kind]; count++) left[playerId].push(kind)
        }
    }
    const random = seeded(3)
    for (const coords of SPACES.slice(0, SPACES.length - 2)) {
        const [playerId] = state.activePlayerIds
        const hand = left[playerId]
        const kind = hand.splice(Math.floor(random() * hand.length), 1)[0]
        state = act(game, state, { type: 'placePiece', playerId, coords, kind })
    }
    return { game, state }
}

write('placement-ends', 'Placement ends', placementEnds())
