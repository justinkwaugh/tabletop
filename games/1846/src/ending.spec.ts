import { Market1846 } from './stock.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, GameResult, assert, assertExists, type GameAction } from '@tabletop/common'
import {
    certificatesOwnedBy,
    finiteCashOwnedBy,
    getCompany,
    isEndGame,
    nextOperatingCompany,
    placeStockMarker,
    trainsOwnedBy
} from '@tabletop/18xx'
import { buyTrain, constructionGame, emergencyBuyingGame, stockGame } from './testSupport.js'
import { corporateFinanceChoices } from './corporateFinance.js'
import { EndingRules1846 } from './ending.js'
import { Runtime } from './definition/gameDefinition.js'
import { DraftCompanies } from './catalog.js'
import type { EighteenFortySixProjectedState } from './state.js'

type Table = ReturnType<typeof stockGame>

function bankCash(table: Table) {
    const cash = table.state.cash.find((cash) => cash.owner.kind === 'bank')
    assertExists(cash)
    return cash
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
        case 'BuyingTrains':
            assertExists(companyId)
            return trainsOwnedBy(table.state, { kind: 'company', companyId }).length
                ? table.act('FinishOperatingTurn', { companyId })
                : buyTrain(table, '2')
        default:
            throw Error(`Unexpected test step: ${table.state.machineState}`)
    }
}

function playUntil(table: Table, ready: () => boolean) {
    for (let i = 0; i < 60 && !ready(); i++) advance(table)
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
    const table = emergencyBuyingGame(2000)
    buyTrain(table, '2')
    return table
}

describe('1846 game endings', () => {
    it('finishes both operating rounds after the bank breaks while floating IC in the first stock round', () => {
        const table = stockGame()
        bankCash(table).amount = 1
        const before = structuredClone(table.state)
        table.launch('IC', 100)
        expect(table.state.machineState).toBe('StockRound')
        expect(table.state.bank.broken).toBe(true)
        expect(bankCash(table).amount).toBe('unlimited')
        expect(table.state.gameEnding).toEqual({ reason: 'Bank broken', finalOperatingSet: 1 })
        playUntil(table, () => table.state.machineState === 'GameOver')
        expect(table.state.operatingSet).toMatchObject({
            number: 1,
            roundNumber: 2,
            completed: true
        })
        expect(table.state.stockRound.number).toBe(1)
        expect(
            table.actions.filter((action) => action.type === 'StartOperatingRound')
        ).toHaveLength(2)
        expect(table.actions.filter((action) => action.type === 'ScheduleGameEnd')).toHaveLength(1)
        expect(table.state.activePlayerIds).toEqual([])
        expect(table.engine.getValidActionTypesForPlayer(table.game, table.hydrated, 'p1')).toEqual(
            []
        )
        expect(() => table.act('FinishStockTurn')).toThrow()
        replayAndUndo(table, before, table.actions)
    })

    it('records private-income bank exhaustion at the start of OR1 and values privates at face value', () => {
        const table = stockGame()
        bankCash(table).amount = 1
        const before = structuredClone(table.state)
        playUntil(table, () => table.state.operatingSet !== undefined)
        expect(table.state.gameEnding).toEqual({ reason: 'Bank broken', finalOperatingSet: 1 })
        expect(table.state.operatingSet?.roundNumber).toBe(1)
        playUntil(table, () => table.state.machineState === 'GameOver')
        for (const wealth of table.state.finalWealth ?? []) {
            const certificates = certificatesOwnedBy(table.state, {
                kind: 'player',
                playerId: wealth.playerId
            })
            const printedValue = certificates.reduce((sum, certificate) => {
                const company = DraftCompanies.find(
                    (company) => company.id === certificate.companyId
                )
                assertExists(company)
                return sum + company.price
            }, 0)
            expect(wealth.total).toBe(
                finiteCashOwnedBy(table.state, { kind: 'player', playerId: wealth.playerId }) +
                    printedValue
            )
        }
        const ending = table.actions.find(isEndGame)
        expect(ending?.metadata).toEqual(table.state.finalWealth)
        assertExists(Runtime.scoring)
        assertExists(table.state.finalWealth)
        expect(Runtime.scoring.finalScores(table.state)).toEqual(
            Object.fromEntries(
                table.state.finalWealth.map((wealth) => [wealth.playerId, wealth.total])
            )
        )
        replayAndUndo(table, before, table.actions)
    })

    it.each(['exact', 'overdraw'] as const)(
        'finishes OR2 after %s exhaustion during corporate issuance',
        (exhaustion) => {
            const table = buyingGame()
            playUntil(
                table,
                () =>
                    corporateFinanceChoices(table.hydrated).some(
                        (choice) => choice.operation === 'issue'
                    ) && table.state.operatingSet?.roundNumber === 2
            )
            const choice = corporateFinanceChoices(table.hydrated).find(
                (choice) => choice.operation === 'issue'
            )
            assertExists(choice)
            bankCash(table).amount = exhaustion === 'exact' ? choice.amount : 1
            const before = structuredClone(table.state)
            const from = table.actions.length
            table.act('CorporateFinance', choice)
            expect(table.state.gameEnding).toEqual({ reason: 'Bank broken', finalOperatingSet: 1 })
            expect(table.state.result).toBeUndefined()
            playUntil(table, () => table.state.machineState === 'GameOver')
            expect(table.state.stockRound.number).toBe(1)
            expect(table.state.operatingSet?.roundNumber).toBe(2)
            expect(table.actions.at(-1)?.type).toBe('EndGame')
            expect(table.actions.at(-2)?.type).toBe('FinishOperatingTurn')
            replayAndUndo(table, before, table.actions.slice(from))
        }
    )

    it('schedules the next set when the bank breaks in a later stock round', () => {
        const table = buyingGame()
        playUntil(table, () => table.state.machineState === 'StockRound')
        expect(table.state.operatingSet?.completed).toBe(true)
        table.buy('IC')
        for (let i = 0; i < 2; i++) table.finishTurn()
        const sale = table
            .choices()
            .sells.find(
                (choice) => choice.sales[0].companyId === 'IC' && choice.sales[0].shares === 1
            )
        assertExists(sale)
        bankCash(table).amount = 1
        table.act('SellShares', sale)
        expect(table.state.gameEnding).toEqual({ reason: 'Bank broken', finalOperatingSet: 2 })
        expect(table.state.result).toBeUndefined()
        playUntil(table, () => table.state.machineState === 'GameOver')
        expect(table.state.operatingSet).toMatchObject({
            number: 2,
            roundNumber: 2,
            completed: true
        })
        expect(table.state.stockRound.number).toBe(2)
    })

    it('ends immediately on the last company closure, overriding a scheduled bank ending, and records tied cash totals', () => {
        const table = buyingGame()
        for (const company of table.state.companies) {
            if (company.id !== 'IC') company.closed = true
        }
        table.state.certificates = table.state.certificates.map((certificate) => {
            if (certificate.companyId === 'IC' || certificate.retired) return certificate
            const { owner: _owner, poolId: _poolId, ...retired } = certificate
            return { ...retired, retired: true }
        })
        for (const cash of table.state.cash) {
            if (cash.owner.kind === 'player') cash.amount = 100
        }
        table.state.gameEnding = { reason: 'Bank broken', finalOperatingSet: 2 }
        const zero = Market1846.spaces.find((space) => space.price === 0)
        assertExists(zero)
        placeStockMarker(table.state.stockMarket, 'IC', zero.id)
        table.state.machineState = 'ClosingOperatingCorporation'
        const before = structuredClone(table.state)
        const result = table.act('CloseCorporation', {
            companyId: 'IC',
            source: ActionSource.System
        })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'CloseCorporation',
            'ScheduleGameEnd',
            'EndGame'
        ])
        expect(table.state.gameEnding).toEqual({ reason: 'All companies closed' })
        expect(table.state.result).toBe(GameResult.Draw)
        expect(table.state.winningPlayerIds.toSorted()).toEqual(['p1', 'p2', 'p3'])
        expect(table.state.finalWealth?.map((wealth) => wealth.total)).toEqual([100, 100, 100])
        replayAndUndo(table, before, result.processedActions)
    })

    it('keeps unstarted corporations and open privates eligible to prevent an all-closed ending', () => {
        const table = stockGame()
        for (const company of table.state.companies) company.closed = true
        getCompany(table.state, 'IC').closed = false
        expect(EndingRules1846.trigger(table.hydrated)).toBeUndefined()
        getCompany(table.state, 'IC').closed = true
        getCompany(table.state, 'MAIL').closed = false
        expect(EndingRules1846.trigger(table.hydrated)).toBeUndefined()
    })

    it('values stock at the final price without adding corporate cash or assets', () => {
        const table = buyingGame()
        const president = getCompany(table.state, 'IC').president
        assert(president?.kind === 'player')
        const certificate = certificatesOwnedBy(table.state, president).find(
            (certificate) => certificate.companyId === 'IC'
        )
        assert(certificate?.kind === 'share')
        expect(EndingRules1846.certificateItems(table.state, certificate)).toEqual([
            {
                assetId: certificate.id,
                label: getCompany(table.state, 'IC').name,
                value:
                    certificate.shares *
                    Market1846.companySpace(table.state.stockMarket, 'IC').price
            }
        ])
        getCompany(table.state, 'IC').closed = true
        expect(EndingRules1846.certificateItems(table.state, certificate)).toEqual([])
    })

    it('does not schedule an ending when the first final train is bought in the 3–5-player game', () => {
        const table = constructionGame('IV')
        expect(table.state.phaseId).toBe('IV')
        expect(table.state.gameEnding).toBeUndefined()
        expect(EndingRules1846.trigger(table.hydrated)).toBeUndefined()
    })
})
