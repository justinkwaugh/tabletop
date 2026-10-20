// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, GameEngine, PlayerStatus, assert, assertExists } from '@tabletop/common'
import { startingPositionFile } from '@tabletop/common/testing'
import { nextOperatingCompany } from '@tabletop/18xx'
import {
    Definition,
    Runtime,
    hydrateEighteenFortySixState,
    trainBuyingChoices1846
} from '@tabletop/1846'
import { Scenarios1846 } from '@tabletop/1846/scenarios'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')
const SEED = 7

function gameData(config) {
    return {
        id: '1846-scenario',
        typeId: '1846',
        ownerId: 'p1',
        seed: SEED,
        config,
        players: Array.from({ length: 3 }, (_, index) => ({
            id: `p${index + 1}`,
            userId: `p${index + 1}`,
            name: `Player ${index + 1}`,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    }
}

/** IC buying trains in phase II with $1000, holding the given depot trains, each bought as `definitionId`. */
function phaseIIPurchase(held) {
    const engine = new GameEngine(Scenarios1846.runtime)
    const prepared = Scenarios1846.runtime.initializer.initializeGame(
        gameData({ examplePosition: 'trains' }),
        Scenarios1846
    )
    const { startedGame, initialState } = engine.startGame(
        prepared,
        SEED.toString(16).padStart(32, '0')
    )
    const plain = Runtime.initializer.initializeGame(gameData(undefined), Definition)
    const game = { ...startedGame, config: plain.config }
    const state = initialState
    const companyId = state.trainPurchaseStep?.companyId
    assert(companyId === 'IC', 'The trains position has IC buying trains')
    state.phaseId = 'II'
    const remaining = [...held]
    state.trainInventory.trains = state.trainInventory.trains.map((train) => {
        const index = remaining.findIndex((entry) => entry.depotId === train.definitionId)
        if (train.status !== 'depot' || index < 0) return train
        const [{ definitionId }] = remaining.splice(index, 1)
        return { ...train, definitionId, status: 'owned', owner: { kind: 'company', companyId } }
    })
    return { engine, game, state, companyId }
}

/** Takes every unsold train of the given depot types out of play, so the next type is on sale. */
function soldOut(position, depotIds) {
    position.state.trainInventory.trains = position.state.trainInventory.trains.filter(
        (train) => train.status !== 'depot' || !depotIds.includes(train.definitionId)
    )
    return position
}

function play(position, type, fields = {}) {
    const result = position.engine.executeCanonicalAction({
        game: position.game,
        state: position.state,
        action: {
            id: `prepare:${position.state.actionCount}`,
            gameId: position.game.id,
            type,
            source: ActionSource.User,
            playerId: position.state.activePlayerIds[0],
            ...fields
        }
    })
    position.state = result.updatedState
    return result
}

function buyTrain(position, definitionId) {
    const offer = trainBuyingChoices1846(hydrateEighteenFortySixState(position.state))?.offers.find(
        (choice) => choice.definitionId === definitionId
    )
    assertExists(offer, `IC can buy a ${definitionId}`)
    const { price, ...request } = offer
    return play(position, 'BuyTrain', { ...request, expectedPrice: price })
}

function write(slug, name, { game, state }) {
    const file = startingPositionFile({ slug, name, game, state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

mkdirSync(OUT, { recursive: true })

/** Returns IC's newest trains of `definitionId` to the market and refills its treasury to $1000, so it can buy again. */
function readyToBuyAgain(position, definitionId) {
    position.state.trainInventory.trains = position.state.trainInventory.trains.map((train) =>
        train.status === 'owned' && train.definitionId === definitionId
            ? { id: train.id, definitionId: train.definitionId, status: 'market' }
            : train
    )
    const treasury = position.state.cash.find(
        (balance) =>
            balance.owner.kind === 'company' && balance.owner.companyId === position.companyId
    )
    const bank = position.state.cash.find((balance) => balance.owner.kind === 'bank')
    assertExists(treasury)
    assertExists(bank)
    bank.amount -= 1000 - treasury.amount
    treasury.amount = 1000
    return position
}

/** Plays every other step, building and buying nothing, until IC is buying trains again. */
function untilBuying(position) {
    for (let i = 0; i < 200; i++) {
        const companyId = nextOperatingCompany(position.state)
        const step = position.state.machineState
        if (step === 'BuyingTrains' && companyId === position.companyId) return position
        if (step === 'StockRound') play(position, 'FinishStockTurn')
        else if (step === 'LayingTrack') play(position, 'FinishTrack', { companyId })
        else if (step === 'PlacingStations') play(position, 'FinishStations', { companyId })
        else if (step === 'BuyingTrains') play(position, 'FinishOperatingTurn', { companyId })
        else throw new Error(`Unexpected scenario step: ${step}`)
    }
    throw new Error('IC never bought trains again')
}

function phaseChange(position, definitionId) {
    const result = buyTrain(position, definitionId)
    assert(
        result.processedActions.some((action) => action.type === 'AdvancePhase'),
        `Buying the first ${definitionId} starts a phase`
    )
    return position
}

const phaseIII = soldOut(
    phaseIIPurchase([
        { depotId: '2', definitionId: '2' },
        { depotId: '4', definitionId: '4' }
    ]),
    ['2', '4']
)
phaseChange(phaseIII, '5')
write('obsolete-2-train-in-phase-iii', 'Obsolete 2-train in phase III', phaseIII)

const phaseIV = soldOut(
    phaseIIPurchase([
        { depotId: '4', definitionId: '4' },
        { depotId: '4', definitionId: '3/5' }
    ]),
    ['2', '4']
)
phaseChange(phaseIV, '5')
readyToBuyAgain(phaseIV, '5')
soldOut(phaseIV, ['5'])
untilBuying(phaseIV)
phaseChange(phaseIV, '6')
write('obsolete-4-and-3-5-trains-in-phase-iv', 'Obsolete 4 and 3/5 trains in phase IV', phaseIV)
