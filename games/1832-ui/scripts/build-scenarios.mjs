// Writes the positions the dev harness offers under Scenarios, one file each in ../src/scenarios.
// Build the logic package first: node scripts/build-scenarios.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ActionSource, assertExists, scenarioJson } from '@tabletop/common'
import { startingPosition, startingPositionFile } from '@tabletop/common/testing'
import { evaluateShareSale, getCompany } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoStockRules,
    EighteenThirtyTwoTrainDepot,
    formSystem
} from '@tabletop/1832'
import { EighteenThirtyTwoScenarios } from '@tabletop/1832/scenarios'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenarios')

function write(slug, name, play) {
    const file = startingPositionFile({ slug, name, game: play.game, state: play.state })
    writeFileSync(join(OUT, file.fileName), file.contents)
}

function writePlayed(slug, name, play, steps) {
    const start = startingPosition({ slug, name, game: play.game, state: play.state })
    let state = start.state
    const actions = []
    const act = (type, fields = {}, playerId = state.activePlayerIds[0]) => {
        const action = {
            id: `${slug}-${state.actionCount}`,
            gameId: start.game.id,
            source: ActionSource.User,
            playerId,
            type,
            ...fields
        }
        const result = play.engine.executeCanonicalAction({ game: start.game, state, action })
        actions.push(...result.processedActions)
        state = result.updatedState
    }
    steps(act, () => state)
    const game = { ...start.game, activePlayerIds: [...state.activePlayerIds] }
    writeFileSync(join(OUT, `${slug}.json`), scenarioJson({ game, state, actions }))
}

function priceProtection(act, state) {
    const playerId = state().activePlayerIds[0]
    const seller = { kind: 'player', playerId }
    const request = { playerId, seller, sales: [{ companyId: 'CG', shares: 2 }] }
    const { details, reason } = evaluateShareSale(state(), request, EighteenThirtyTwoStockRules)
    assertExists(details, reason)
    act('SellShares', { ...request, expectedProceeds: details.proceeds })
    act('FinishStockTurn')
}

function excessTrains(act) {
    const price = EighteenThirtyTwoTrainDepot.trainDefinition('5').price
    act('BuyTrain', {
        companyId: 'CG',
        trainId: '1832/5/18',
        definitionId: '5',
        expectedPrice: price
    })
    act('DiscardTrain', { companyId: 'CG', trainId: '1832/3/8' })
}

function trainOffer(act) {
    act('OfferPurchase', {
        companyId: 'CG',
        asset: { kind: 'train', trainId: '1832/4/15' },
        seller: { kind: 'company', companyId: 'ACL' },
        price: 300
    })
}

/**
 * AMTK, formed from the ACL and CG, at its train step in phase 4 with one 4-train, $100 in its
 * treasury and $600 with its president, so it cannot buy the $300 4-train alone (§11.6.7).
 */
function systemTrainHelp() {
    const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3)
    const state = structuredClone(play.state)
    state.phaseId = '4'
    const cg = getCompany(state, 'CG').president
    formSystem(state, ['ACL', 'CG'], cg.playerId)
    const president = getCompany(state, 'AMTK').president.playerId
    const amtk = { kind: 'company', companyId: 'AMTK' }
    const train = EighteenThirtyTwoTrainDepot.nextTrain(state.trainInventory, '4')
    EighteenThirtyTwoTrainDepot.purchase(state.trainInventory, train.id, '4', amtk)
    for (const cash of state.cash) {
        if (cash.owner.kind === 'company' && cash.owner.companyId === 'AMTK') cash.amount = 100
        if (cash.owner.kind === 'player' && cash.owner.playerId === president) cash.amount = 600
    }
    state.operatingSet.companyOrder = ['AMTK']
    state.trainPurchaseStep = { companyId: 'AMTK', purchasedTrainIds: [] }
    state.activePlayerIds = [president]
    state.turnManager.series = [{ type: 'turn', playerId: president, start: 0 }]
    play.replaceState(state)
    return play
}

mkdirSync(OUT, { recursive: true })
write('system-train-help', 'System train help', systemTrainHelp())
writePlayed(
    'price-protection',
    'Price protection',
    playExample(EighteenThirtyTwoScenarios, 'trading', 3),
    priceProtection
)
writePlayed(
    'excess-trains',
    'Excess trains',
    playExample(EighteenThirtyTwoScenarios, 'phases', 3),
    excessTrains
)
writePlayed(
    'train-offer',
    'Train offer',
    playExample(EighteenThirtyTwoScenarios, 'phases', 3),
    trainOffer
)
