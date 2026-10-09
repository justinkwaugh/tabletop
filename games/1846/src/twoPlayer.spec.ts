import { describe, expect, it } from 'vitest'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    TrackConstruction,
    getCompany,
    nextOperatingCompany,
    trainsOwnedBy,
    sharesOwned,
    validateStations,
    evaluateSharePurchase
} from '@tabletop/18xx'
import { openingGame, installTile, layTrack, buyTrain } from './testSupport.js'
import { openingPurchaseChoices } from './publicDistribution.js'
import { StockRules1846 } from './stock.js'
import {
    TrainDepot1846,
    TrainRules1846,
    trainBuyingChoices1846,
    finalDepotEmpty
} from './trains.js'
import { TransferRules1846 } from './acquisitions.js'
import { TrackRules1846 } from './track.js'
import { pendingBlockingStations } from './stations.js'
import { corporateFinanceChoices } from './corporateFinance.js'
import type { EighteenFortySixProjectedState } from './state.js'

type Table = ReturnType<typeof openingGame>
function purchaseRemaining(table: Table) {
    for (let i = 0; i < 8 && table.state.machineState === 'BuyingOpeningCompanies'; i++) {
        const choice = openingPurchaseChoices(table.hydrated, table.state.activePlayerIds[0])[0]
        assertExists(choice)
        table.act('BuyOpeningCompany', choice)
    }
    expect(table.state.machineState).toBe('StockRound')
}
function stockGame(seed = 7) {
    const table = openingGame(2, seed)
    purchaseRemaining(table)
    return table
}
function advance(table: Table) {
    const companyId = nextOperatingCompany(table.state)
    switch (table.state.machineState) {
        case 'StockRound':
            return table.finishTurn()
        case 'AssigningSteamboat':
            return table.act('AssignSteamboat')
        case 'LayingTrack':
            return table.act('FinishTrack', { companyId })
        case 'RunningTrains':
            return table.act('RunTrains', { companyId, routes: [] })
        case 'DistributingEarnings':
            return table.act('DistributeEarnings', { companyId, choice: 'withhold' })
        case 'BuyingTrains': {
            const choices = trainBuyingChoices1846(table.hydrated)
            assertExists(choices)
            if (choices.mayFinish) return table.act('FinishOperatingTurn', { companyId })
            const offer = choices.offers[0]
            assertExists(offer)
            const { price, ...request } = offer
            return table.act('BuyTrain', { ...request, expectedPrice: price })
        }
        default:
            throw Error(`Unexpected step ${table.state.machineState}`)
    }
}
function playUntil(table: Table, ready: () => boolean) {
    for (let i = 0; i < 120 && !ready(); i++) advance(table)
    expect(ready()).toBe(true)
}
function replayAndUndo(
    table: Table,
    before: EighteenFortySixProjectedState,
    actions: GameAction[]
) {
    let state = before
    for (const action of actions)
        state = table.engine.applyProcessedAction({ game: table.game, state, action })
    expect(state).toEqual(table.state)
    for (const action of actions.toReversed())
        state = table.engine.undoProcessedAction({ state, action })
    expect(state).toEqual(before)
}
function buyingGame() {
    const table = stockGame()
    table.launch('IC', 100)
    playUntil(
        table,
        () =>
            table.state.machineState === 'BuyingTrains' &&
            table.state.trainPurchaseStep?.companyId === 'IC'
    )
    const cash = table.state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'IC'
    )
    assertExists(cash)
    cash.amount = 5000
    return table
}
function lastTrainGame(roundNumber = 1) {
    const table = buyingGame()
    table.state.phaseId = 'IV'
    for (const company of table.state.companies) if (company.kind !== 'major') company.closed = true
    const finals = table.state.trainInventory.trains.filter(
        (train) => train.status === 'depot' && train.definitionId === '6'
    )
    expect(finals).toHaveLength(4)
    table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) => {
        if (train.id === finals[3].id) return train
        if (finals.some((candidate) => candidate.id === train.id))
            return { ...train, status: 'owned', owner: { kind: 'company', companyId: 'NYC' } }
        return { id: train.id, definitionId: train.definitionId, status: 'removed' }
    })
    assertExists(table.state.operatingSet)
    table.state.operatingSet.roundNumber = roundNumber
    return table
}

describe('1846 complete two-player rules', () => {
    it('enters SR1 after preliminary ORs, then runs the first regular OR in ascending price order', () => {
        const table = openingGame()
        table.act('BuyOpeningCompany', { companyId: 'MS', expectedPrice: 140 })
        table.act('PassOpeningPurchase')
        table.act('PassOpeningPurchase')
        playUntil(table, () => table.state.machineState === 'BuyingOpeningCompanies')
        const before = structuredClone(table.state)
        const offset = table.actions.length
        purchaseRemaining(table)
        expect(table.state.operatingSet).toBeUndefined()
        expect(table.state.stockRound.number).toBe(1)
        expect(table.state.activePlayerIds).toEqual([table.state.priorityDealPlayerId])
        replayAndUndo(table, before, table.actions.slice(offset))
        table.launch('IC', 40)
        table.launch('NYC', 90)
        playUntil(table, () => table.state.machineState !== 'StockRound')
        expect(table.state.operatingSet).toMatchObject({
            number: 1,
            roundNumber: 1,
            companyOrder: ['MS', 'BIG4', 'IC', 'NYC']
        })
        playUntil(table, () => table.state.operatingSet?.roundNumber === 2)
        expect(table.state.operatingSet?.companyOrder).toEqual(['MS', 'BIG4', 'NYC', 'IC'])
    })

    it('allows 70% ownership, rejects 80%, and reduces the certificate limit only after an active corporation closes', () => {
        const table = stockGame()
        expect(
            StockRules1846.certificateLimit(table.hydrated, {
                kind: 'player',
                playerId: table.state.activePlayerIds[0]
            })
        ).toBe(19)
        const playerId = table.state.activePlayerIds[0]
        table.launch('IC', 40)
        const owner = { kind: 'player' as const, playerId }
        const ordinary = table.state.certificates
            .filter((certificate) => !certificate.retired)
            .filter(
                (certificate) =>
                    !certificate.retired &&
                    certificate.companyId === 'IC' &&
                    certificate.kind === 'share' &&
                    !certificate.president
            )
        for (const certificate of ordinary.slice(0, 4)) certificate.owner = owner
        expect(sharesOwned(table.state, 'IC', owner)).toBe(6)
        table.finishTurn()
        table.buy('IC')
        expect(sharesOwned(table.state, 'IC', owner)).toBe(7)
        table.finishTurn()
        const certificate = table.state.certificates.find(
            (certificate) =>
                !certificate.retired &&
                certificate.companyId === 'IC' &&
                certificate.owner.kind === 'company'
        )
        assertExists(certificate)
        expect(
            evaluateSharePurchase(
                table.hydrated,
                { playerId, buyer: owner, certificateId: certificate.id },
                StockRules1846
            ).details
        ).toBeUndefined()
        getCompany(table.state, 'NYC').closed = true
        expect(StockRules1846.certificateLimit(table.hydrated, owner)).toBe(16)
        getCompany(table.state, 'GT').closed = true
        expect(StockRules1846.certificateLimit(table.hydrated, owner)).toBe(16)
    })

    it('floats NYC into the free home slot beside a removed Erie blocker', () => {
        const table = stockGame(27)
        expect(table.state.removedCorporationIds).toContain('ERIE')
        table.launch('NYC', 40)
        expect(
            table.state.stations.find(
                (station) => station.companyId === 'NYC' && station.status === 'placed'
            )
        ).toMatchObject({ position: { locationId: 'D20', slot: 1 } })
        validateStations(
            table.state,
            table.state.companies.map((company) => company.id)
        )
    })

    it('places a deferred blocker on a green upgrade, preserving it on later upgrades and replay/Undo', () => {
        const table = buyingGame()
        expect(table.state.removedCorporationIds).toContain('PRR')
        table.state.phaseId = 'II'
        table.state.machineState = 'LayingTrack'
        table.state.trackStep = { companyId: 'IC', lays: [], completed: false }
        installTile(table, 'E11', '18xx:5')
        const home = table.state.stations.find(
            (station) => station.companyId === 'IC' && station.status === 'placed'
        )
        assertExists(home)
        if (home.status === 'placed') home.position = { locationId: 'E11', nodeId: 'city', slot: 0 }
        const choice = new TrackConstruction(table.hydrated, TrackRules1846)
            .choices('E11')
            .find((choice) => choice.definitionId === '18xx:14')
        assertExists(choice)
        const before = structuredClone(table.state)
        const result = layTrack(table, choice)
        expect(table.state.stations.find((station) => station.id === 'PRR:blocking')).toMatchObject(
            { status: 'placed', position: { locationId: 'E11', slot: 1 } }
        )
        expect(
            pendingBlockingStations(table.state).some((station) => station.companyId === 'PRR')
        ).toBe(false)
        validateStations(
            table.state,
            table.state.companies.map((company) => company.id)
        )
        replayAndUndo(table, before, result.processedActions)
        table.state.phaseId = 'III'
        table.state.trackStep = { companyId: 'IC', lays: [], completed: false }
        const brown = new TrackConstruction(table.hydrated, TrackRules1846).choices('E11')[0]
        assertExists(brown)
        layTrack(table, brown)
        expect(
            table.state.stations.filter((station) => station.id === 'PRR:blocking')
        ).toHaveLength(1)
    })

    it.each([1, 2])(
        'ends after the next complete OR pair when the last Phase IV train is bought in OR %i',
        (roundNumber) => {
            const table = lastTrainGame(roundNumber)
            const before = structuredClone(table.state)
            const offset = table.actions.length
            buyTrain(table, '7/8')
            expect(table.state.gameEnding).toEqual({
                reason: 'Last Phase IV train',
                finalOperatingSet: 2
            })
            expect(TrainDepot1846.remaining(table.state.trainInventory, '6')).toBe(0)
            playUntil(table, () => table.state.machineState === 'GameOver')
            expect(table.state.operatingSet).toMatchObject({ number: 2, roundNumber: 2 })
            expect(table.state.result).toBeDefined()
            replayAndUndo(table, before, table.actions.slice(offset))
        }
    )

    it('shortens a last-train ending when the bank subsequently breaks in the current set', () => {
        const table = lastTrainGame()
        buyTrain(table, '6')
        playUntil(table, () => corporateFinanceChoices(table.hydrated).length > 0)
        const bank = table.state.cash.find((cash) => cash.owner.kind === 'bank')
        assertExists(bank)
        bank.amount = 1
        const before = structuredClone(table.state)
        const offset = table.actions.length
        const issuance = corporateFinanceChoices(table.hydrated).find(
            (choice) => choice.operation === 'issue'
        )
        assertExists(issuance)
        table.act('CorporateFinance', issuance)
        expect(table.state.bank.broken).toBe(true)
        expect(table.state.gameEnding).toEqual({ reason: 'Bank broken', finalOperatingSet: 1 })
        playUntil(table, () => table.state.machineState === 'GameOver')
        expect(table.state.operatingSet).toMatchObject({ number: 1, roundNumber: 2 })
        replayAndUndo(table, before, table.actions.slice(offset))
    })

    it('waives compulsory buying only while the final depot and bank resale pool are empty and protects each seller’s last train', () => {
        const table = lastTrainGame()
        const last = table.state.trainInventory.trains.find((train) => train.status === 'depot')
        assertExists(last)
        table.state.trainInventory.trains = table.state.trainInventory.trains.map((train) =>
            train.id === last.id
                ? { ...train, status: 'owned', owner: { kind: 'company', companyId: 'GT' } }
                : train
        )
        expect(finalDepotEmpty(table.hydrated)).toBe(true)
        expect(trainBuyingChoices1846(table.hydrated)).toMatchObject({
            mayFinish: true,
            needsFunding: false,
            offers: []
        })
        expect(
            TransferRules1846.canPurchase(table.hydrated, 'IC', { kind: 'train', trainId: last.id })
        ).toBe(false)
        const sellerTrain = trainsOwnedBy(table.state, { kind: 'company', companyId: 'NYC' })[0]
        expect(
            TransferRules1846.canPurchase(table.hydrated, 'IC', {
                kind: 'train',
                trainId: sellerTrain.id
            })
        ).toBe(true)
        const returned = table.state.trainInventory.trains.find(
            (train) => train.definitionId === '5' && train.status === 'removed'
        )
        assertExists(returned)
        returned.status = 'market'
        expect(finalDepotEmpty(table.hydrated)).toBe(false)
        expect(TrainRules1846.requiresTrain(table.hydrated, 'IC')).toBe(true)
        expect(
            TransferRules1846.canPurchase(table.hydrated, 'IC', { kind: 'train', trainId: last.id })
        ).toBe(true)
    })
})
