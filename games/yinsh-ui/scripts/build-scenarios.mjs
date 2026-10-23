// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultGameConfig, GameEngine, PlayerStatus } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    Definition,
    HydratedYinshGameState,
    MachineState,
    MARKERS,
    POINTS,
    pointFromName,
    YinshInfo,
    YinshRuntime
} from '@tabletop/yinsh'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(YinshRuntime)
const FIRST = 'player-1'
const SECOND = 'player-2'

/**
 * A game with Alice (White) to move. rings and markers are point names per player id;
 * removed counts the rings each player has already taken off.
 */
function position({ rings, markers = {}, removed = {}, version = 'Standard', fill }) {
    const game = YinshRuntime.initializer.initializeGame(
        {
            id: 'scenario',
            typeId: 'yinsh',
            ownerId: 'owner',
            config: { ...defaultGameConfig(YinshInfo.configurator?.options ?? []), version },
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
    const pointAt = (name) => {
        const coords = pointFromName(name)
        return state.board.points.find((p) => p.coords.q === coords.q && p.coords.r === coords.r)
    }
    for (const [playerId, names] of Object.entries(rings)) {
        for (const name of names) pointAt(name).ringPlayerId = playerId
    }
    for (const [playerId, names] of Object.entries(markers)) {
        for (const name of names) pointAt(name).markerPlayerId = playerId
    }
    if (fill) fillMarkers(state, fill)
    for (const player of state.players) {
        player.ringsRemoved = removed[player.playerId] ?? 0
    }
    state.machineState = MachineState.MovingRing
    state.activePlayerIds = [FIRST]
    const hydrated = new HydratedYinshGameState(state)
    for (const player of state.players) {
        if (hydrated.ringsToPlace(player.playerId) !== 0) throw Error('Wrong ring count')
        if (hydrated.board.hasRow(player.playerId)) throw Error('A row is already standing')
    }
    return { game: startedGame, state }
}

// Fills the board from the middle out until `count` markers stand on it, leaving `vacant` empty.
// White only where q - r is a multiple of 3: that never puts five of one color in a line.
function fillMarkers(state, { count, vacant }) {
    const keep = vacant.map(pointFromName)
    let placed = state.board.points.filter((p) => p.markerPlayerId !== undefined).length
    for (const coords of POINTS) {
        if (placed === count) break
        if (keep.some((k) => k.q === coords.q && k.r === coords.r)) continue
        const point = state.board.points.find(
            (p) => p.coords.q === coords.q && p.coords.r === coords.r
        )
        if (point.ringPlayerId !== undefined || point.markerPlayerId !== undefined) continue
        point.markerPlayerId = (((coords.q - coords.r) % 3) + 3) % 3 === 0 ? FIRST : SECOND
        placed += 1
    }
    if (placed !== count) throw Error('Not enough room for the markers')
}

function write(slug, name, scenario) {
    const file = startingPositionFile({ slug, name, ...scenario })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

// Rule G1–G3: moving the ring on F3 anywhere leaves a marker that completes B3–F3; then take
// the row and a ring.
write(
    'form-a-row',
    'Form a row',
    position({
        rings: {
            [FIRST]: ['F3', 'C6', 'H5', 'E9', 'J7'],
            [SECOND]: ['D5', 'G8', 'I8', 'G4', 'C2']
        },
        markers: {
            [FIRST]: ['B3', 'C3', 'D3', 'E3', 'E6', 'G7'],
            [SECOND]: ['F6', 'F7', 'H6', 'D7']
        }
    })
)

// Rule G4–G5: moving F3 to F6 flips F4 and F5, making a run of seven, B4–H4, crossed at F4 by
// the row F4–J8. Taking any five of the run or the crossing row leaves no second row.
write(
    'choose-the-rows',
    'Choose the rows',
    position({
        rings: {
            [FIRST]: ['F3', 'B2', 'H9', 'K8', 'I5'],
            [SECOND]: ['E8', 'G9', 'D7', 'J6', 'C5']
        },
        markers: {
            [FIRST]: ['B4', 'C4', 'D4', 'E4', 'G4', 'H4', 'G5', 'H6', 'I7', 'J8'],
            [SECOND]: ['F4', 'F5']
        }
    })
)

// Rule G6–G7: moving F4 to F2 completes Alice's row B4–F4 and, by flipping F3, Bob's B3–F3.
// Alice takes hers first; then Bob takes his before he moves.
write(
    'rows-for-both',
    'Rows for both',
    position({
        rings: {
            [FIRST]: ['F4', 'C7', 'H8', 'J9', 'D9'],
            [SECOND]: ['G7', 'E8', 'H5', 'I7', 'K9']
        },
        markers: {
            [FIRST]: ['B4', 'C4', 'D4', 'E4', 'F3'],
            [SECOND]: ['B3', 'C3', 'D3', 'E3']
        }
    })
)

// Rule H1: Alice has removed two rings; completing B3–F3 and taking a third ring wins.
write(
    'win-on-a-third-row',
    'Win on a third row',
    position({
        rings: {
            [FIRST]: ['F3', 'H6', 'D8'],
            [SECOND]: ['E6', 'G5', 'I9', 'C4']
        },
        markers: {
            [FIRST]: ['B3', 'C3', 'D3', 'E3', 'G8', 'G9'],
            [SECOND]: ['F6', 'F7', 'E7', 'H9', 'D5', 'D6']
        },
        removed: { [FIRST]: 2, [SECOND]: 1 }
    })
)

// Blitz: the first row wins.
write(
    'blitz-row',
    'Blitz row',
    position({
        rings: {
            [FIRST]: ['F3', 'C6', 'H5', 'E9', 'J7'],
            [SECOND]: ['D5', 'G8', 'I8', 'G4', 'C2']
        },
        markers: {
            [FIRST]: ['B3', 'C3', 'D3', 'E3', 'E6'],
            [SECOND]: ['F6', 'F7', 'H6']
        },
        version: 'Blitz'
    })
)

// Agreed rule: Bob's rings fill column K, shut in by Alice's rings on J7–J10 and the marker on
// K7. After Alice moves F3, Bob cannot move and passes, so Alice moves again.
write(
    'bob-passes',
    'Bob passes',
    position({
        rings: {
            [FIRST]: ['J7', 'J8', 'J9', 'J10', 'F3'],
            [SECOND]: ['K8', 'K9', 'K10']
        },
        markers: { [FIRST]: ['K7'] },
        removed: { [SECOND]: 2 }
    })
)

// Rule H3: 50 of the 51 markers are on the board. Moving C6 to C7 puts down the last one and
// ends the game: Alice has taken off one ring to Bob's none, so she wins. Moving the F3 ring
// instead also puts down the last marker, but it completes B3–F3: the row goes back to the pool
// and play goes on.
write(
    'markers-run-out',
    'Markers run out',
    position({
        rings: {
            [FIRST]: ['F3', 'C6', 'H8', 'J10'],
            [SECOND]: ['E9', 'G4', 'J7', 'B2', 'K9']
        },
        markers: { [FIRST]: ['B3', 'C3', 'D3', 'E3'] },
        removed: { [FIRST]: 1 },
        fill: { count: MARKERS - 1, vacant: ['F4', 'C7'] }
    })
)
