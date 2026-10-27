// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Each is a bot game played up to the position, with its whole history.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { omitGameState, scenarioJson } from '@tabletop/common'
import { MachineState } from '@tabletop/power-grid'
import { TestGame } from '@tabletop/power-grid/testing'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

function write(slug, name, players, until) {
    const id = `scenario-${slug}`
    const game = new TestGame(players, { id, name })
    game.playUntil(until)
    const contents = scenarioJson({
        game: { ...omitGameState(game.game), activePlayerIds: [...game.state.activePlayerIds] },
        state: game.state,
        actions: game.actions
    })
    writeFileSync(join(OUT, `${slug}.json`), contents)
    console.log(
        slug,
        game.state.machineState,
        'round',
        game.hydrated.round,
        'step',
        game.state.step
    )
}

const at =
    (machineState, round, extra = () => true) =>
    (state) =>
        state.machineState === machineState && state.round >= round && extra(state)

const richBuilder = (state) =>
    state.players.find((player) => player.playerId === state.activePlayerIds[0])?.money >= 45

mkdirSync(OUT, { recursive: true })
write('round-2-auction', 'Round 2 auction', 4, at(MachineState.ChoosingPlant, 2))
write('bidding', 'Bidding war', 4, at(MachineState.Bidding, 2))
write('buying-resources', 'Buying resources', 4, at(MachineState.BuyingResources, 3, richBuilder))
write('building', 'Building', 4, at(MachineState.Building, 3, richBuilder))
write('powering', 'Bureaucracy', 4, at(MachineState.Powering, 3))
write('scrapping', 'Scrapping a plant', 4, at(MachineState.ScrappingPlant, 1))
write(
    'step-2',
    'Step 2',
    5,
    at(MachineState.ChoosingPlant, 1, (state) => state.step === 2)
)
write(
    'step-3',
    'Step 3',
    5,
    at(MachineState.BuyingResources, 1, (state) => state.step === 3)
)
write(
    'step-3-card',
    'Step 3 card drawn',
    4,
    at(MachineState.ChoosingPlant, 1, (state) => state.step3Drawn)
)
write('game-end', 'Game end', 4, (state) => state.result !== undefined)
write('trust-setup', 'Trust setup', 2, (state) => (state.trust?.startingCities.length ?? 0) === 2)
write('against-the-trust', 'Against the Trust', 2, at(MachineState.Building, 4))
