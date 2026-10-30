import {
    corporateFinanceChoices,
    purchaseChoices,
    type CorporateFinanceRequest
} from '@tabletop/18xx'
import { TrainDepot1833NE, TrainRules1833NE } from '../src/trains.js'
import { CorporateFinanceRules1833NE, Market1833NE } from '../src/stock.js'
import { TransferRules1833NE } from '../src/privates.js'
import { table, type Table } from './table.js'
import {
    buyAllPrivates,
    buyTrain,
    launch,
    lay,
    ownedTrainId,
    passStockRound,
    placeStation,
    route
} from './flow.js'

/** Sets a corporation's treasury, the bank making up the difference. */
export function setCash(game: Table, companyId: string, amount: number): void {
    const state = structuredClone(game.state)
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )!
    const bank = state.cash.find((entry) => entry.owner.kind === 'bank')!
    if (typeof bank.amount !== 'number' || typeof account.amount !== 'number')
        throw new Error('Finite cash expected')
    bank.amount -= amount - account.amount
    account.amount = amount
    game.state = state
}

function operatingCompany(game: Table): string | undefined {
    const state = game.state
    return (
        state.trackStep?.companyId ??
        state.routeStep?.companyId ??
        state.earningsStep?.companyId ??
        state.trainPurchaseStep?.companyId
    )
}

/** Plays out operating turns, running no routes and withholding, until the set's end. */
export function finishOperatingSet(game: Table): void {
    while (operatingCompany(game)) {
        const valid = game.valid()
        const companyId = operatingCompany(game)
        if (valid.includes('FinishTrack')) game.act('FinishTrack', { companyId })
        else if (valid.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else if (valid.includes('DistributeEarnings'))
            game.act('DistributeEarnings', { companyId, choice: 'withhold' })
        else if (valid.includes('FinishOperatingTurn'))
            game.act('FinishOperatingTurn', { companyId })
        else throw new Error(`${companyId} is stuck in ${game.state.machineState}: ${valid}`)
    }
}

/**
 * A takeover position in outline: the B&W and the Hartford, joined west of Boston, reach phase
 * II at the end of OR2. With ``separatePresidents`` the next player launches the Hartford;
 * otherwise the B&W's president does.
 */
export function takeoverExample({ separatePresidents = false } = {}) {
    const game = table(4, 7, { takeover: true })
    buyAllPrivates(game)
    const president = game.player
    launch(game, 'B&W', 80)
    if (!separatePresidents) while (game.player !== president) game.act('FinishStockTurn')
    else game.act('FinishStockTurn')
    const hartfordPresident = game.player
    launch(game, 'HR', 40)
    passStockRound(game)

    setCash(game, 'HR', 200)
    lay(game, 'D23', '18xx:9', [1, 4])
    game.act('FinishTrack', { companyId: 'HR' })
    buyTrain(game, '2')
    game.act('FinishOperatingTurn', { companyId: 'HR' })
    lay(game, 'F23', '18xx:58', [2, 4])
    lay(game, 'E22', '18xx:6', [5, 1])
    game.act('FinishTrack', { companyId: 'B&W' })
    buyTrain(game, '2+1')
    game.act('FinishOperatingTurn', { companyId: 'B&W' })

    // The phase I trains sell out and the B&W buys the first 3/5.
    const state = structuredClone(game.state)
    state.phaseId = 'II'
    while (TrainDepot1833NE.remaining(state.trainInventory, '2') !== 0)
        TrainDepot1833NE.export(state.trainInventory, '2')
    const next = TrainDepot1833NE.nextTrain(state.trainInventory, '3/5')!
    TrainDepot1833NE.purchase(state.trainInventory, next.id, '3/5', {
        kind: 'company',
        companyId: 'B&W'
    })
    game.state = state
    finishOperatingSet(game)
    return { game, president, hartfordPresident }
}

function passOthers(game: Table, playerId: string): void {
    while (game.player !== playerId) game.act('FinishStockTurn')
}

function buyTreasuryShare(game: Table, companyId: string): void {
    const certificate = game.state.certificates.find(
        (entry) =>
            entry.companyId === companyId &&
            entry.kind === 'share' &&
            !entry.president &&
            entry.owner.kind === 'company'
    )
    if (!certificate) throw new Error(`${companyId} has no treasury share`)
    game.act('BuyShares', {
        buyer: { kind: 'player', playerId: game.player },
        certificateId: certificate.id,
        expectedPrice: Market1833NE.companySpace(game.state.stockMarket, companyId).price
    })
}

function corporateFinance(game: Table, operation: 'issue' | 'redeem', shares: number): void {
    const choice: CorporateFinanceRequest | undefined = corporateFinanceChoices(
        game.hydrated,
        CorporateFinanceRules1833NE
    ).find((entry) => entry.operation === operation && entry.shares === shares)
    if (!choice) throw new Error(`No ${operation} of ${shares}`)
    game.act('CorporateFinance', choice)
}

function untilBuyingTrains(game: Table, companyId: string): void {
    while (game.state.machineState !== 'BuyingTrains') {
        const valid = game.valid()
        if (valid.includes('FinishTrack')) game.act('FinishTrack', { companyId })
        else if (valid.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else game.act('DistributeEarnings', { companyId, choice: 'withhold' })
    }
}

/**
 * The rulebook's takeover example (p. 15), played: a 4-player Takeover game in which the
 * player who bought the Champlain & St. Lawrence launches the B&W and the Hartford. The other
 * corporations that buy out the phase I trains before OR2's B&W turn are not in the example,
 * so the depot's remaining phase I trains are taken out there.
 */
export function rulebookTakeoverExample() {
    const game = table(4, 7, { takeover: true })
    buyAllPrivates(game)
    const president = game.player
    launch(game, 'B&W', 80)
    passOthers(game, president)
    launch(game, 'HR', 40)
    for (let share = 0; share < 4; share++) {
        passOthers(game, president)
        buyTreasuryShare(game, 'HR')
    }
    passOthers(game, president)
    game.act('SellShares', {
        seller: { kind: 'player', playerId: president },
        sales: [{ companyId: 'HR', shares: 4 }],
        expectedProceeds: 160
    })
    buyTreasuryShare(game, 'B&W')
    passOthers(game, president)
    buyTreasuryShare(game, 'B&W')
    passStockRound(game)

    // OR1, in reverse price order: the Hartford lays track NE and S and buys a 2.
    lay(game, 'D23', '18xx:9', [1, 4])
    lay(game, 'C26', '18xx:57', [0, 3])
    untilBuyingTrains(game, 'HR')
    buyTrain(game, '2')
    game.act('FinishOperatingTurn', { companyId: 'HR' })
    // The B&W issues two shares, lays two tiles west of Boston and buys two 2+1s.
    corporateFinance(game, 'issue', 2)
    lay(game, 'F23', '18xx:58', [2, 4])
    lay(game, 'E22', '18xx:6', [5, 1])
    untilBuyingTrains(game, 'B&W')
    buyTrain(game, '2+1')
    buyTrain(game, '2+1')
    game.act('FinishOperatingTurn', { companyId: 'B&W' })

    const state = structuredClone(game.state)
    while (TrainDepot1833NE.remaining(state.trainInventory, '2') !== 0)
        TrainDepot1833NE.export(state.trainInventory, '2')
    game.state = state

    // OR2: the B&W tokens Worcester, runs, pays and buys the first 3/5.
    placeStation(game, 'E22')
    game.act('FinishTrack', { companyId: 'B&W' })
    const [first, second] = game.state.trainInventory.trains.filter(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === 'B&W'
    )
    game.act('RunTrains', {
        companyId: 'B&W',
        routes: [
            route(game.state, first.id, { locationId: 'G22', nodeId: 'city-0' }, ['F23', 'E22']),
            route(game.state, second.id, { locationId: 'E22', nodeId: 'city' }, ['D23', 'C24'])
        ]
    })
    game.act('DistributeEarnings', { companyId: 'B&W', choice: 'pay' })
    buyTrain(game, '3/5')
    game.act('FinishOperatingTurn', { companyId: 'B&W' })
    // The Hartford redeems four shares, buys the New Haven ferry, runs there, pays and buys the
    // Champlain & St. Lawrence from its president.
    corporateFinance(game, 'redeem', 4)
    game.act('BuyFerry', { companyId: 'HR', locationId: 'C26' })
    game.act('FinishTrack', { companyId: 'HR' })
    game.act('RunTrains', {
        companyId: 'HR',
        routes: [
            route(
                game.state,
                ownedTrainId(game, 'HR', '2'),
                { locationId: 'C24', nodeId: 'city' },
                ['C26']
            )
        ]
    })
    game.act('DistributeEarnings', { companyId: 'HR', choice: 'pay' })
    const purchase = purchaseChoices(
        game.hydrated,
        president,
        TransferRules1833NE,
        TrainRules1833NE
    ).find(
        ({ request }) => request.asset.kind === 'private' && request.asset.privateCompanyId === 'P3'
    )
    if (!purchase) throw new Error('The Hartford can buy the Champlain & St. Lawrence')
    game.act('OfferPurchase', { ...purchase.request, price: 50 })
    if (game.state.purchaseOffer)
        game.act('RespondToPurchaseOffer', { offerId: game.state.purchaseOffer.id, accept: true })
    game.act('FinishOperatingTurn', { companyId: 'HR' })
    return { game, president }
}
