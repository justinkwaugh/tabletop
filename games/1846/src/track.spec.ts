import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import {
    TrackConstruction,
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    privateIncomePayments
} from '@tabletop/18xx'
import { stockGame, start } from './testSupport.js'
import { TrackRules1846 } from './track.js'
import { EighteenFortySixMap } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { OperatingRules1846 } from './operating.js'

function constructionGame() {
    const table = stockGame()
    table.finishTurn()
    table.finishTurn()
    table.finishTurn()
    return table
}
function choose(table: ReturnType<typeof stockGame>, locationId: string) {
    const choice = new TrackConstruction(table.hydrated, TrackRules1846).choices(locationId)[0]
    assertExists(choice, `Expected a legal lay in ${locationId}`)
    const { companyId, definitionId, rotation, nodeMapping, cost } = choice
    return { companyId, locationId, definitionId, rotation, nodeMapping, expectedCost: cost }
}

describe('1846 phase-I construction', () => {
    it('starts the first independent and pays private income exactly once before its turn', () => {
        const table = stockGame()
        const payments = privateIncomePayments(table.state)
        const before = structuredClone(table.state.cash)
        table.finishTurn()
        table.finishTurn()
        const result = table.finishTurn()
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'FinishStockTurn',
            'CompleteStockRound',
            'StartOperatingSet',
            'StartOperatingRound',
            'StartOperatingTurn'
        ])
        expect(table.state.operatingSet).toMatchObject({
            companyOrder: ['MS', 'BIG4'],
            roundCount: 2,
            privateIncomePaid: true
        })
        expect(table.state.trackStep).toEqual({ companyId: 'MS', completed: false, lays: [] })
        const president = getCompany(table.state, 'MS').president
        expect(table.state.activePlayerIds).toEqual([
            president?.kind === 'player' ? president.playerId : ''
        ])
        for (const payment of payments) {
            const old = before.find(
                (entry) => JSON.stringify(entry.owner) === JSON.stringify(payment.to)
            )!
            expect(finiteCashOwnedBy(table.state, payment.to)).toBe(
                Number(old.amount) +
                    payments
                        .filter((other) => JSON.stringify(other.to) === JSON.stringify(payment.to))
                        .reduce((sum, item) => sum + item.amount, 0)
            )
        }
        expect(() => table.act('StartOperatingRound', { source: ActionSource.System })).toThrow()
    })
    it('orders first-OR prices ascending while retaining stack order', () => {
        const table = stockGame()
        for (const id of ['IC', 'GT', 'NYC'])
            Object.assign(getCompany(table.state, id), { started: true, floated: true })
        placeStockMarker(table.state.stockMarket, 'IC', '0:5')
        placeStockMarker(table.state.stockMarket, 'GT', '0:4')
        placeStockMarker(table.state.stockMarket, 'NYC', '0:4')
        expect(OperatingRules1846.companyOrder(table.state)).toEqual([
            'MS',
            'BIG4',
            'GT',
            'NYC',
            'IC'
        ])
    })
    it('lays two connected yellow tiles from treasury and rejects a third', () => {
        const table = constructionGame()
        const initial = finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'MS' })
        table.act('LayTile', choose(table, 'C13'))
        const second = choose(table, 'B16')
        table.act('LayTile', second)
        expect(finiteCashOwnedBy(table.state, { kind: 'company', companyId: 'MS' })).toBe(
            initial - 40
        )
        expect(Object.keys(table.state.tileInventory.placements)).toHaveLength(2)
        expect(table.state.trackStep?.lays).toHaveLength(2)
        expect(
            EighteenFortySixMap.definition.locations.flatMap((location) =>
                new TrackConstruction(table.hydrated, TrackRules1846).choices(location.id)
            )
        ).toEqual([])
        expect(() => table.act('LayTile', second)).toThrow()
        table.act('FinishTrack', { companyId: 'MS' })
        expect(table.state.machineState).toBe('ReadyForRoutes')
        expect(
            table.state.companies.find((company) => company.id === 'MS')?.operated
        ).toBeUndefined()
    })
    it('rejects the wrong player, stale cost, disconnected, sea and fixed-map lays', () => {
        const table = constructionGame()
        const request = choose(table, 'C13')
        expect(() => table.act('LayTile', { ...request, playerId: 'not-the-controller' })).toThrow()
        expect(() => table.act('LayTile', { ...request, expectedCost: 0 })).toThrow()
        for (const locationId of ['D16', 'C17', 'K3', 'H2'])
            expect(() => table.act('LayTile', { ...request, locationId })).toThrow()
    })
    it('charges a tunnel only when completing the connection', () => {
        const table = constructionGame()
        const choices = new TrackConstruction(table.hydrated, TrackRules1846).choices('B16')
        expect(choices.map((choice) => choice.cost)).toContain(20)
        expect(
            choices.find((choice) => choice.definitionId === '18xx:6' && choice.rotation === 4)
                ?.cost
        ).toBe(60)
        const request = choose(table, 'C13')
        expect(
            TrackRules1846.borderCost!(table.hydrated, { ...request, locationId: 'J4' }, 4, 40)
        ).toBe(0)
        table.state.tileInventory = EighteenFortySixTileSet.createInventory([
            { locationId: 'J6', definitionId: '18xx:9', rotation: 1 }
        ])
        expect(
            TrackRules1846.borderCost!(table.hydrated, { ...request, locationId: 'J4' }, 4, 40)
        ).toBe(40)
    })
    it('uses max(base, terrain), adds completed-border costs, and honors IC land grants', () => {
        const table = constructionGame()
        const request = choose(table, 'C13')
        expect(
            TrackRules1846.terrainCost!(table.hydrated, { ...request, locationId: 'F18' }, 80)
        ).toBe(80)
        expect(
            TrackRules1846.terrainCost!(
                table.hydrated,
                { ...request, companyId: 'IC', locationId: 'J4' },
                40
            )
        ).toBe(40)
        expect(
            TrackRules1846.terrainCost!(table.hydrated, { ...request, locationId: 'J4' }, 40)
        ).toBe(60)
    })
    it('blocks private-reserved track until ownership permits it', () => {
        const table = constructionGame()
        const request = choose(table, 'C13')
        expect(
            TrackRules1846.restriction(table.hydrated, { ...request, locationId: 'F14' })
        ).toBeDefined()
        const certificate = table.state.certificates.find(
            (certificate) => certificate.companyId === 'O&I' && !certificate.retired
        )
        assertExists(certificate)
        if (!certificate.retired) certificate.owner = { kind: 'company', companyId: 'MS' }
        expect(
            TrackRules1846.restriction(table.hydrated, { ...request, locationId: 'F14' })
        ).toBeUndefined()
        expect(
            TrackRules1846.restriction(table.hydrated, { ...request, locationId: 'B10' })
        ).toBeUndefined()
    })
    it('replays and reverses construction plus operating-start consequences', () => {
        const table = constructionGame()
        table.act('LayTile', choose(table, 'C13'))
        table.act('FinishTrack', { companyId: 'MS' })
        let state = table.initialState
        for (const action of table.actions)
            state = table.engine.applyProcessedAction({ game: table.game, state, action })
        expect(state).toEqual(table.state)
        for (const action of table.actions.toReversed())
            state = table.engine.undoProcessedAction({ state, action })
        expect(state).toEqual(table.initialState)
    })
    it.each([3, 4, 5])(
        'sets up correct phase-I supply and valid station geometry for %i players',
        (count) => {
            const { state } = start(count)
            expect(
                state.trainInventory.trains.filter((train) => train.status === 'depot')
            ).toHaveLength(count + 2)
            expect(
                EighteenFortySixTileSet.availablePieces(state.tileInventory, '18xx:5')
            ).toHaveLength(3)
            expect(
                EighteenFortySixTileSet.availablePieces(state.tileInventory, '18xx:6')
            ).toHaveLength(4)
            expect(
                EighteenFortySixTileSet.availablePieces(state.tileInventory, '18xx:57')
            ).toHaveLength(4)
            for (const station of state.stations)
                if (station.status === 'placed') {
                    const node = EighteenFortySixMap.location(
                        station.position.locationId
                    ).preprintedTile.nodes.find((node) => node.id === station.position.nodeId)
                    expect(node?.kind).toBe('city')
                    if (node?.kind === 'city')
                        expect(node.stationSlots).toBeGreaterThan(station.position.slot)
                }
        }
    )
})
