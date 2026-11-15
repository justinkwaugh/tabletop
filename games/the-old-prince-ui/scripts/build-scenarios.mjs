// Writes the positions the dev harness offers under Scenarios that are built in code, one file
// each in ../src/scenarios. Build the logic packages first: node scripts/build-scenarios.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameStatus, scenarioJson } from '@tabletop/common'
import { startingPosition } from '@tabletop/common/testing'
import { isBuyShares, sharesOwned } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { setInstruction } from '@tabletop/18xx/testing'
import { TheOldPrinceScenarios } from '@tabletop/the-old-prince/scenarios'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const NAMES = { alex: 'Alex', blair: 'Blair', casey: 'Casey', drew: 'Drew' }

function player(playerId) {
    return { kind: 'player', playerId }
}

/** A position played forward from a stock round through real actions, kept with its history. */
function played(slug, name, play) {
    const example = exampleGame(TheOldPrinceScenarios, 'trading', 4)
    const start = startingPosition({
        slug,
        name,
        game: {
            ...example.game,
            status: GameStatus.Started,
            startedAt: new Date(0),
            players: example.game.players.map((entry) => ({ ...entry, name: NAMES[entry.id] }))
        },
        state: example.state
    })
    let state = start.state
    const actions = []
    const run = (action) => {
        const result = example.engine.executeCanonicalAction({
            game: start.game,
            state,
            action: { ...action, gameId: start.game.id }
        })
        actions.push(...result.processedActions)
        state = result.updatedState
        return result.processedActions
    }
    play({ state: () => state, run })
    writeFileSync(
        join(OUT, `${slug}.json`),
        scenarioJson({
            game: { ...start.game, activePlayerIds: state.activePlayerIds },
            state,
            actions
        })
    )
}

function oneMoreShare(state, playerId, companyId, thenPass) {
    return {
        kind: 'buy',
        companyId,
        preferredPoolId: 'market',
        until: { kind: 'shares', count: sharesOwned(state, companyId, player(playerId)) + 1 },
        thenPass
    }
}

played('turn-recap', 'Turn recap', ({ state, run }) => {
    run(setInstruction('', 'blair', oneMoreShare(state(), 'blair', 'ML', true)))
    run(setInstruction('', 'casey', { kind: 'pass' }))
    run(setInstruction('', 'drew', { kind: 'pass' }))
    const processed = run({
        id: 'alex-buys',
        source: ActionSource.User,
        type: 'BuyShares',
        playerId: 'alex',
        buyer: player('alex'),
        certificateId: 'ML:share:5',
        expectedPrice: 92
    })
    if (!processed.some((action) => isBuyShares(action) && action.playerId === 'blair'))
        throw new Error("Blair's Autobuy did not buy")
    if (state().activePlayerIds[0] !== 'alex') throw new Error('The turn did not come back to Alex')
})
