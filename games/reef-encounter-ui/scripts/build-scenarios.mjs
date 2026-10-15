// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus
} from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import {
    ActionType,
    CoralColor,
    ReefBoards,
    ReefEncounterGameStateValidator,
    ReefEncounterInfo,
    ReefEncounterRuntime
} from '@tabletop/reef-encounter'
import { Definition } from '@tabletop/reef-encounter'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const engine = new GameEngine(ReefEncounterRuntime)

const at = (row, col) => ({ row, col })

/** A two-player game just past setup, on boards 3 and 4, with the first player to act. */
function firstTurn() {
    const game = ReefEncounterRuntime.initializer.initializeGame(
        {
            id: 'reef-scenario',
            typeId: ReefEncounterInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig(defaultGameConfig(ReefEncounterInfo.configurator.options)),
            players: ['Amira', 'Bashir'].map((name, index) => ({
                id: `p${index}`,
                name,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const started = engine.startGame(game, { masterSeed: MASTER_SEED })
    let state = started.initialState
    let count = 0
    const act = (type, payload) => {
        const action = {
            id: `scenario-${count++}`,
            gameId: started.startedGame.id,
            playerId: state.activePlayerIds[0],
            source: ActionSource.User,
            type,
            ...payload
        }
        state = engine.executeCanonicalAction({
            game: started.startedGame,
            state,
            action
        }).updatedState
    }
    for (const _ of state.players) {
        const player = state.players.find(({ playerId }) => playerId === state.activePlayerIds[0])
        const dealt = Object.values(CoralColor).find(
            (color) => player.secretSupplyPolyps[color] > 0
        )
        act(ActionType.FeedParrotfish, { color: dealt })
    }
    for (const _ of state.players) {
        act(ActionType.ChooseLarvaCubes, { colors: [CoralColor.Pink, CoralColor.Grey] })
    }
    const draft = structuredClone(state)
    draft.reefs = [3, 4].map((boardId) => ({
        boardId,
        polyps: ReefBoards[boardId].startingPolyps.map((polyp) => structuredClone(polyp))
    }))
    return { game: started.startedGame, state: draft }
}

const actingPlayer = (state) =>
    state.players.find(({ playerId }) => playerId === state.activePlayerIds[0])
const otherPlayer = (state) =>
    state.players.find(({ playerId }) => playerId !== state.activePlayerIds[0])

function takeFromBag(state, color, count = 1) {
    for (let taken = 0; taken < count; taken++) {
        const index = state.polypBag.items.slice(0, state.polypBag.remaining).indexOf(color)
        if (index < 0) throw new Error(`The bag has no ${color} polyp left`)
        state.polypBag.items.splice(index, 1)
        state.polypBag.remaining -= 1
    }
}

function giveCube(state, player, color) {
    state.larvaCubeSupply[color] -= 1
    player.larvaCubes[color] += 1
}

function giveKnownPolyps(state, player, color, count) {
    takeFromBag(state, color, count)
    player.knownSupplyPolyps[color] += count
}

function write(slug, name, { game, state }) {
    if (!ReefEncounterGameStateValidator.Check(state)) {
        throw new Error(`The ${slug} position is not a valid state`)
    }
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

mkdirSync(OUT, { recursive: true })

write(
    'consumed-polyps-to-spend',
    'Consumed polyps to spend',
    (() => {
        const position = firstTurn()
        const { state } = position
        takeFromBag(state, CoralColor.White)
        takeFromBag(state, CoralColor.Pink)
        actingPlayer(state).consumedPolyps[CoralColor.White] = 1
        actingPlayer(state).consumedPolyps[CoralColor.Pink] = 1
        return position
    })()
)

write(
    'coral-ready-to-eat',
    'Coral ready to eat',
    (() => {
        const position = firstTurn()
        const { state } = position
        const coral = [at(1, 3), at(1, 4), at(2, 4), at(2, 5)]
        takeFromBag(state, CoralColor.White, coral.length)
        state.reefs[0].polyps.push(...coral.map((coords) => ({ coords, color: CoralColor.White })))
        const player = actingPlayer(state)
        state.shrimps.push({ playerId: player.playerId, boardId: 3, coords: at(1, 3) })
        player.shrimpsInSupply -= 1
        return position
    })()
)

write(
    'last-orange-larva-cube',
    'Last orange larva cube',
    (() => {
        const position = firstTurn()
        const { state } = position
        const [first, second] = [actingPlayer(state), otherPlayer(state)]
        while (state.larvaCubeSupply[CoralColor.Orange] > 0) {
            const player = state.larvaCubeSupply[CoralColor.Orange] % 2 === 0 ? first : second
            giveCube(state, player, CoralColor.Orange)
        }
        return position
    })()
)

write(
    'bag-searches',
    'Bag searches',
    (() => {
        const position = firstTurn()
        const { state } = position
        const player = actingPlayer(state)
        state.bonusPolyps[CoralColor.Pink] = 0
        otherPlayer(state).knownSupplyPolyps[CoralColor.Pink] += 1
        state.bonusPolyps[CoralColor.White] = 0
        otherPlayer(state).knownSupplyPolyps[CoralColor.White] += 1
        giveCube(state, player, CoralColor.White)
        giveKnownPolyps(state, player, CoralColor.White, 2)
        return position
    })()
)

write(
    'both-polyp-sources',
    'Both polyp sources',
    (() => {
        const position = firstTurn()
        const { state } = position
        const player = actingPlayer(state)
        giveCube(state, player, CoralColor.White)
        giveKnownPolyps(state, player, CoralColor.White, 5)
        takeFromBag(state, CoralColor.White)
        player.consumedPolyps[CoralColor.White] = 1
        return position
    })()
)
