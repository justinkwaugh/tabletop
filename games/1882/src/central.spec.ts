import { describe, expect, it } from 'vitest'
import {
    evaluateCompanyStart,
    finiteCashOwnedBy,
    getCompany,
    presidentCertificate,
    privateOwner
} from '@tabletop/18xx'
import { edit, kit, opened } from '../test/kit.js'
import { centralHomePositions, centralParSpaces } from './central.js'
import { neutralStationId } from './neutralStations.js'
import { rebellionDue, rebellionTrainOrdinal } from './rebellion.js'
import { CompanyRules1882, StockRules1882 } from './stock.js'
import { TrainDepot1882 } from './trains.js'

/** The first stock round, on the Saskatchewan Central owner's turn. */
function centralTurn() {
    const game = opened(4)
    const owner = privateOwner(game.state, 'SC')
    if (owner?.kind !== 'player') throw new Error('A player owns the Saskatchewan Central')
    edit(game, (state) => kit.turnFor(state, owner.playerId))
    return { game, playerId: owner.playerId }
}

describe('1882 Saskatchewan Central', () => {
    it('exchanges for the SCR presidency, paying one share at par, its home placed at once (§7.1.2)', () => {
        const { game, playerId } = centralTurn()
        const cash = finiteCashOwnedBy(game.state, { kind: 'player', playerId })
        const [marketSpaceId] = centralParSpaces(game.state)
        const home = centralHomePositions(game.state).find(
            (position) => position.locationId === 'G7'
        )
        game.act('ConvertCentral', { marketSpaceId, home })
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId })).toBe(cash - 100)
        expect(presidentCertificate(game.state, 'SCR')?.owner).toEqual({ kind: 'player', playerId })
        expect(getCompany(game.state, 'SC').closed).toBe(true)
        expect(game.state.stations.find((station) => station.id === 'SCR:home')).toMatchObject({
            status: 'placed',
            position: home
        })
        // Phase 2's 2-trains are on top, so no extra train joins them.
        expect(TrainDepot1882.remaining(game.state.trainInventory, '3')).toBe(4)
        // The exchange is the turn's purchase.
        expect(
            evaluateCompanyStart(
                game.hydrated,
                { playerId, buyer: { kind: 'player', playerId }, companyId: 'GTP', marketSpaceId },
                StockRules1882,
                CompanyRules1882
            ).reason
        ).toBeDefined()
    })

    it('starts the SCR only from its private (§7.1.2)', () => {
        const { game } = centralTurn()
        expect(
            CompanyRules1882.startTerms(
                game.state,
                'SCR',
                { kind: 'player', playerId: 'p1' },
                '0:3'
            )
        ).toMatch(/private/)
    })

    it('may take the place of a neutral station, which leaves the game (§7.1.2)', () => {
        const { game } = centralTurn()
        const position = { locationId: 'J8', nodeId: 'city', slot: 0 }
        edit(game, (state) => {
            state.stations = state.stations.map((station) =>
                station.id === neutralStationId('GTP')
                    ? { ...station, status: 'placed', position }
                    : station
            )
        })
        game.act('ConvertCentral', {
            marketSpaceId: centralParSpaces(game.state)[0],
            home: position
        })
        expect(
            game.state.stations.find((station) => station.id === neutralStationId('GTP'))?.status
        ).toBe('removed')
    })

    it('adds an extra train on top, putting the rebellion one train later (§7.1.2)', () => {
        const { game } = centralTurn()
        edit(game, (state) => {
            state.rebellion = { definitionId: '3' }
            state.trainInventory.trains = state.trainInventory.trains.filter(
                (train) => train.definitionId !== '2'
            )
        })
        game.act('ConvertCentral', {
            marketSpaceId: centralParSpaces(game.state)[0],
            home: centralHomePositions(game.state)[0]
        })
        expect(TrainDepot1882.remaining(game.state.trainInventory, '3')).toBe(5)
        expect(rebellionTrainOrdinal(game.state)).toBe(2)
        const sell = (count: number) => {
            const inventory = structuredClone(game.state.trainInventory)
            for (const train of inventory.trains
                .filter((entry) => entry.definitionId === '3')
                .slice(0, count))
                Object.assign(train, { status: 'market' })
            return { ...game.state, trainInventory: inventory }
        }
        expect(rebellionDue(sell(1))).toBe(false)
        expect(rebellionDue(sell(2))).toBe(true)
    })
})

describe('1882 Canadian National', () => {
    it('starts only while a neutral station is on the board (§10.4)', () => {
        const game = opened(4)
        const buyer = { kind: 'player' as const, playerId: game.player }
        expect(CompanyRules1882.startTerms(game.state, 'CN', buyer, '0:3')).toMatch(/neutral/)
        edit(game, (state) => {
            state.stations = state.stations.map((station) =>
                station.id === neutralStationId('HBR')
                    ? {
                          ...station,
                          status: 'placed',
                          position: { locationId: 'J8', nodeId: 'city', slot: 0 }
                      }
                    : station
            )
        })
        expect(CompanyRules1882.startTerms(game.state, 'CN', buyer, '0:3')).not.toEqual(
            expect.any(String)
        )
    })
})
