// Writes the games the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Each is a game played by the autoplay helper and saved with its whole Action History, since
// the end-of-game chart and the politics card pile labels are worked out from that history.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import { Definition, LowenherzRuntime, MachineState, isTakePoliticsCard } from '@tabletop/lowenherz'
import { nextAction } from '@tabletop/lowenherz/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const engine = new GameEngine(LowenherzRuntime)

/** Plays a four-player game from `masterSeed` until `stop` holds or the game ends. */
function play(slug, masterSeed, stop) {
    const game = LowenherzRuntime.initializer.initializeGame(
        {
            id: `scenario-${slug}`,
            typeId: Definition.info.id,
            ownerId: 'p0',
            config: {},
            players: ['Ana', 'Bruno', 'Carmen', 'Diego'].map((name, index) => ({
                id: `p${index}`,
                name,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, { masterSeed })
    let state = initialState
    const actions = []
    while (state.machineState !== MachineState.EndOfGame && !stop(state, actions)) {
        const result = engine.executeCanonicalAction({
            game: startedGame,
            state,
            action: nextAction(state, startedGame.id)
        })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { game: startedGame, state, actions }
}

function write(slug, scenario) {
    writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(scenario))
}

function holdsCardsFromBothPiles(state, actions) {
    const playerId = state.activePlayerIds[0]
    const held = state.players.find((player) => player.playerId === playerId)?.politicsCards ?? []
    const piles = new Set(
        actions
            .filter((action) => isTakePoliticsCard(action) && action.playerId === playerId)
            .map((take) => take.pile)
    )
    return held.length >= 2 && piles.size === 2
}

mkdirSync(OUT, { recursive: true })

write(
    'game-over',
    play('game-over', '0123456789abcdef0123456789abcdef', () => false)
)

const bothPiles = play(
    'politics-cards-from-both-piles',
    'fedcba9876543210fedcba9876543210',
    holdsCardsFromBothPiles
)
if (bothPiles.state.machineState === MachineState.EndOfGame) {
    throw new Error('No turn found where the acting player holds cards from both politics piles')
}
write('politics-cards-from-both-piles', bothPiles)
