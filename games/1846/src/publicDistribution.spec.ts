import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    TrackConstruction,
    finiteCashOwnedBy,
    getCompany,
    privateOwner,
    trainsOwnedBy
} from '@tabletop/18xx'
import { openingGame, installTile } from './testSupport.js'
import { TrackRules1846 } from './track.js'
import { openingPurchaseChoices, unboughtOpeningCompanies } from './publicDistribution.js'
import { DraftCompanies } from './catalog.js'
import { Runtime } from './definition/gameDefinition.js'
import { hydrateEighteenFortySixState, type EighteenFortySixProjectedState } from './state.js'
import { TrainDepot1846 } from './trains.js'

type Table = ReturnType<typeof openingGame>
function buy(table: Table, companyId: string) {
    const choice = openingPurchaseChoices(table.hydrated, table.state.activePlayerIds[0]).find(
        (choice) => choice.companyId === companyId
    )
    assertExists(choice, 'Opening company must be affordable')
    return table.act('BuyOpeningCompany', choice)
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
function finishOpeningOperations(table: Table) {
    for (let i = 0; i < 20 && table.state.machineState !== 'BuyingOpeningCompanies'; i++) {
        const companyId = table.state.trackStep?.companyId
        if (table.state.machineState === 'AssigningSteamboat') table.act('AssignSteamboat')
        else if (table.state.machineState === 'LayingTrack') table.act('FinishTrack', { companyId })
        else if (table.state.machineState === 'RunningTrains')
            table.act('RunTrains', { companyId: table.state.routeStep?.companyId, routes: [] })
        else throw Error(`Unexpected opening step ${table.state.machineState}`)
    }
    expect(table.state.machineState).toBe('BuyingOpeningCompanies')
}

describe('1846 two-player opening', () => {
    it.each([2, 3, 4, 5])(
        'places independent stations before distribution for %i players',
        (count) => {
            const { state } = openingGame(count)
            for (const company of DraftCompanies.filter(
                (company) => company.kind === 'independent'
            )) {
                expect(
                    state.stations.filter((station) => station.companyId === company.id)
                ).toEqual([
                    {
                        id: `${company.id}:station:1`,
                        companyId: company.id,
                        status: 'placed',
                        position: { locationId: company.home, nodeId: 'city', slot: 0 }
                    }
                ])
                expect(
                    state.stationReservations.some(
                        (reservation) => reservation.companyId === company.id
                    )
                ).toBe(false)
                expect(getCompany(state, company.id).started).toBeFalsy()
            }
        }
    )

    it('blocks construction beyond an unbought independent during preliminary operations', () => {
        const table = openingGame()
        buy(table, 'MS')
        table.act('PassOpeningPurchase')
        table.act('PassOpeningPurchase')
        expect(table.state.machineState).toBe('LayingTrack')
        expect(unboughtOpeningCompanies(table.hydrated)).toContain('BIG4')
        installTile(table, 'C13', '18xx:8', 4)
        installTile(table, 'D12', '18xx:9')
        installTile(table, 'E11', '18xx:57')
        installTile(table, 'F10', '18xx:9')
        installTile(table, 'G9', '18xx:57')
        expect(new TrackConstruction(table.hydrated, TrackRules1846).choices('H8')).toEqual([])
        table.state.stations = table.state.stations.filter(
            (station) => station.companyId !== 'BIG4'
        )
        expect(
            new TrackConstruction(table.hydrated, TrackRules1846).choices('H8').length
        ).toBeGreaterThan(0)
    })

    it.each([1, 7, 11, 27])('sets up public companies, cash and removals with seed %i', (seed) => {
        const { state } = openingGame(2, seed)
        expect(state.draft).toEqual({ kind: 'public', stage: 'buying', passedPlayerIds: [] })
        expect(state.machineState).toBe('BuyingOpeningCompanies')
        expect(
            state.removedCorporationIds.filter((id) => ['ERIE', 'GT', 'NYC', 'PRR'].includes(id))
        ).toHaveLength(1)
        expect(
            state.removedCorporationIds.filter((id) => ['B&O', 'C&O', 'IC'].includes(id))
        ).toHaveLength(1)
        for (const group of ['orange', 'blue'])
            expect(
                DraftCompanies.filter(
                    (company) =>
                        company.kind === 'private' &&
                        company.group === group &&
                        !state.removedPrivateIds.includes(company.id)
                )
            ).toHaveLength(2)
        expect(
            state.cash.filter((cash) => cash.owner.kind === 'player').map((cash) => cash.amount)
        ).toEqual([600, 600])
        expect(finiteCashOwnedBy(state, { kind: 'bank' })).toBe(5800)
        expect(TrainDepot1846.remaining(state.trainInventory, '2')).toBe(5)
        expect(TrainDepot1846.remaining(state.trainInventory, '4')).toBe(5)
        expect(TrainDepot1846.remaining(state.trainInventory, '5')).toBe(3)
        expect(state.activePlayerIds).toEqual([state.players[1].playerId])
        expect(state.priorityDealPlayerId).toBe(state.players[0].playerId)
        if (state.removedCorporationIds.includes('ERIE'))
            expect(state.stations.find((station) => station.id === 'ERIE:blocking')).toMatchObject({
                status: 'placed',
                position: { locationId: 'D20', nodeId: 'city', slot: 0 }
            })
    })

    it('makes the first purchase mandatory and rejects wrong actors, prices, cards and sources', () => {
        const table = openingGame()
        expect(() => table.act('PassOpeningPurchase')).toThrow()
        expect(
            table.engine.getValidActionTypesForPlayer(
                table.game,
                table.hydrated,
                table.state.activePlayerIds[0]
            )
        ).toEqual(['BuyOpeningCompany'])
        for (const fields of [
            { companyId: 'MS', expectedPrice: 139 },
            { companyId: 'MS', expectedPrice: 140, playerId: table.state.priorityDealPlayerId },
            { companyId: 'MS', expectedPrice: 140, source: ActionSource.System },
            { companyId: 'blank:1', expectedPrice: 0 }
        ])
            expect(() => table.act('BuyOpeningCompany', fields)).toThrow()
        expect(() => table.act('ChooseDraftCard', { cardId: 'MS', revealsInfo: true })).toThrow()
    })

    it('settles independent purchases without replacing home stations and reverses ownership, treasury and train', () => {
        const table = openingGame()
        const before = structuredClone(table.state)
        const playerId = table.state.activePlayerIds[0]
        const result = buy(table, 'MS')
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId })).toBe(460)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'MS' })).toBe(60)
        expect(finiteCashOwnedBy(table.state, { kind: 'bank' })).toBe(5880)
        expect(getCompany(table.state, 'MS')).toMatchObject({
            started: true,
            president: { kind: 'player', playerId }
        })
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'MS' })).toHaveLength(1)
        expect(table.state.stations.find((station) => station.companyId === 'MS')).toMatchObject({
            status: 'placed',
            position: { locationId: 'C15' }
        })
        expect(table.state.stations).toEqual(before.stations)
        expect(result.processedActions[0]).toMatchObject({
            metadata: { cardId: 'MS', price: 140, playerId }
        })
        expect(table.state.activePlayerIds).toEqual([table.state.priorityDealPlayerId])
        replayAndUndo(table, before, result.processedActions)
    })

    it('resets consecutive passes on a purchase and pays two private incomes before resuming', () => {
        const table = openingGame()
        const owner = table.state.activePlayerIds[0]
        buy(table, 'C&WI')
        table.act('PassOpeningPurchase')
        buy(table, 'MAIL')
        expect(table.state.draft).toEqual({ kind: 'public', stage: 'buying', passedPlayerIds: [] })
        table.act('PassOpeningPurchase')
        const before = structuredClone(table.state)
        const cash = finiteCashOwnedBy(table.state, { kind: 'player', playerId: owner })
        const result = table.act('PassOpeningPurchase')
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'PassOpeningPurchase',
            'StartOperatingSet',
            'StartOperatingRound',
            'StartOperatingRound',
            'ResumeOpeningPurchases'
        ])
        expect(finiteCashOwnedBy(table.state, { kind: 'player', playerId: owner })).toBe(cash + 20)
        expect(table.state.activePlayerIds).toEqual([table.state.players[1].playerId])
        expect(table.state.stockRound.number).toBe(1)
        expect(table.state.operatingSet).toMatchObject({
            number: 1,
            roundNumber: 2,
            completed: true
        })
        expect(table.state.draft).toEqual({ kind: 'public', stage: 'buying', passedPlayerIds: [] })
        replayAndUndo(table, before, result.processedActions)
    })

    it('operates only purchased independents, then can repeat the opening cycle', () => {
        const table = openingGame()
        const before = structuredClone(table.state)
        buy(table, 'MS')
        for (let set = 1; set <= 2; set++) {
            table.act('PassOpeningPurchase')
            table.act('PassOpeningPurchase')
            expect(table.state.operatingSet?.companyOrder).toEqual(['MS'])
            expect(table.state.trackStep?.companyId).toBe('MS')
            expect(table.state.draft).toEqual({ kind: 'public', stage: 'operating' })
            expect(() => buy(table, 'MAIL')).toThrow()
            finishOpeningOperations(table)
            expect(table.state.operatingSet).toMatchObject({
                number: set,
                roundNumber: 2,
                completed: true
            })
            expect(table.state.stockRound.number).toBe(1)
        }
        expect(trainsOwnedBy(table.state, { kind: 'company', companyId: 'BIG4' })).toEqual([])
        replayAndUndo(table, before, table.actions)
    })

    it.each(['MAIL', 'MS'])(
        'discounts the final %s company and automatically grants it at the debt floor',
        (last) => {
            const table = openingGame()
            const before = structuredClone(table.state)
            while (unboughtOpeningCompanies(table.hydrated).length > 1) {
                const companyId = unboughtOpeningCompanies(table.hydrated).find((id) => id !== last)
                assertExists(companyId)
                buy(table, companyId)
            }
            const company = DraftCompanies.find((company) => company.id === last)
            assertExists(company)
            for (let passes = 0; passes < company.price / 10; passes++) {
                table.act('PassOpeningPurchase')
                expect(table.state.operatingSet).toBeUndefined()
            }
            expect(table.state.machineState).toBe('StockRound')
            expect(table.state.draft).toEqual({ kind: 'public', stage: 'complete' })
            expect(table.state.purchases.at(-1)).toMatchObject({
                cardId: last,
                price: company.debt
            })
            expect(table.actions.at(-1)).toMatchObject({
                metadata: { purchase: { cardId: last, price: company.debt } }
            })
            expect(table.state.result).toBeUndefined()
            expect(table.state.activePlayerIds).toEqual([table.state.priorityDealPlayerId])
            replayAndUndo(table, before, table.actions)
        }
    )

    it('keeps all offered companies and purchases public to both players and spectators', () => {
        const table = openingGame()
        const before = structuredClone(table.state)
        const result = buy(table, 'MAIL')
        assertExists(Runtime.visibility)
        for (const perspective of [
            ...table.state.players.map((player) => ({
                kind: 'player' as const,
                playerId: player.playerId
            })),
            { kind: 'spectator' as const }
        ]) {
            const projected = Runtime.visibility.state.project(before, perspective)
            expect(projected.draft).toEqual(before.draft)
            expect(
                unboughtOpeningCompanies(hydrateEighteenFortySixState(projected))
            ).toHaveLength(8)
            const after = Runtime.visibility.state.project(table.state, perspective)
            expect(after.purchases).toEqual(table.state.purchases)
            expect(privateOwner(after, 'MAIL')).toEqual({
                kind: 'player',
                playerId: before.activePlayerIds[0]
            })
            const action = Runtime.visibility.actions.project(
                result.processedActions[0],
                perspective
            )
            expect(action).toMatchObject({
                companyId: 'MAIL',
                expectedPrice: 80,
                metadata: { cardId: 'MAIL', price: 80 }
            })
        }
    })
})
