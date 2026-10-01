import { describe, expect, it } from 'vitest'
import { ActionSource, assert, type GameAction } from '@tabletop/common'
import {
    ReserveBidAuction,
    applyTrainPurchase,
    cashOwnedBy,
    getCompany,
    privateTrackConstruction,
    type EighteenXXState,
    type Owner
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import type { ScenarioPosition } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import {
    EighteenThirtyAuctionRules,
    EighteenThirtyPrivatePowerRules,
    EighteenThirtyPrivates,
    EighteenThirtyTrackRules,
    EighteenThirtyTrainDepot,
    EighteenThirtyTrainRules
} from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'

function play(position: ScenarioPosition, prepare: (state: EighteenXXState) => void = () => {}) {
    const { game, engine, state: initial } = exampleGame(EighteenThirtyScenarios, position, 3)
    let state: EighteenXXState = structuredClone(initial)
    prepare(state)
    const validator = Definition.runtime.canonicalStateValidator
    const act = (type: string, fields: object = {}, playerId = state.activePlayerIds[0]) => {
        const action: GameAction = {
            id: `action:${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type,
            ...fields
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        expect(validator?.Check(state)).toBe(true)
    }
    return {
        get state() {
            return state
        },
        act,
        valid: (playerId: string) => engine.getValidActionTypesForPlayer(game, state, playerId)
    }
}

function givePrivate(state: EighteenXXState, privateCompanyId: string, owner: Owner) {
    const existing = state.certificates.find(
        (item) => item.companyId === privateCompanyId && !item.retired
    )
    if (existing && !existing.retired) {
        existing.owner = owner
        return
    }
    const definition = EighteenThirtyPrivates.find((item) => item.id === privateCompanyId)
    assert(definition, 'Unknown 1830 private')
    state.companies.push({
        id: privateCompanyId,
        name: definition.name,
        kind: 'private',
        privateRevenue: definition.revenue
    })
    state.certificates.push({
        id: `${privateCompanyId}:charter`,
        companyId: privateCompanyId,
        kind: 'private',
        certificateLimitCount: 1,
        retired: false,
        owner
    })
}

const cash = (state: EighteenXXState, owner: Owner) => Number(cashOwnedBy(state, owner))
const certificateOwner = (state: EighteenXXState, id: string) => {
    const certificate = state.certificates.find((item) => item.id === id)
    assert(certificate && !certificate.retired, `Missing certificate ${id}`)
    return certificate.owner
}

// Each player in turn buys the cheapest private until the B&O is bought.
function auctionToBaltimore() {
    const game = play('opening')
    const buyers: Record<string, string> = {}
    while (!game.state.pendingPar) {
        const auction = new ReserveBidAuction(game.state, EighteenThirtyAuctionRules)
        const lotId = auction.auction.remainingLotIds[0]
        buyers[lotId] = game.state.activePlayerIds[0]
        game.act('BuyAuctionLot', { lotId, expectedPrice: auction.price(lotId) })
    }
    return { game, buyers }
}

describe('auction awards', () => {
    it('gives the C&A buyer a PRR share without further payment', () => {
        const game = play('opening')
        const auction = () => new ReserveBidAuction(game.state, EighteenThirtyAuctionRules)
        while (auction().auction.remainingLotIds[0] !== 'CA') {
            const lotId = auction().auction.remainingLotIds[0]
            game.act('BuyAuctionLot', { lotId, expectedPrice: auction().price(lotId) })
        }
        const buyer = { kind: 'player', playerId: game.state.activePlayerIds[0] } as const
        const before = cash(game.state, buyer)
        game.act('BuyAuctionLot', { lotId: 'CA', expectedPrice: 160 })
        expect(certificateOwner(game.state, 'PRR:share:1')).toEqual(buyer)
        expect(certificateOwner(game.state, 'CA:charter')).toEqual(buyer)
        expect(cash(game.state, buyer)).toBe(before - 160)
    })

    it('holds the auction until the B&O buyer sets B&O’s par, then starts the stock round', () => {
        const { game, buyers } = auctionToBaltimore()
        const owner = buyers.BOP
        expect(game.state.machineState).toBe('WaterfallAuction')
        expect(game.state.pendingPar).toEqual({ companyId: 'BO', playerId: owner })
        expect(certificateOwner(game.state, 'BO:president')).toEqual({
            kind: 'player',
            playerId: owner
        })
        expect(game.valid(owner)).toEqual(['ParCompany'])
        for (const player of game.state.players.filter((player) => player.playerId !== owner))
            expect(game.valid(player.playerId)).toEqual([])
        expect(() => game.act('ParCompany', { companyId: 'BO', marketSpaceId: '0:0' })).toThrow()

        const before = cash(game.state, { kind: 'player', playerId: owner })
        const space = game.state.stockMarket.spaces.find(
            (space) => space.color === 'pink' && space.price === 100
        )
        assert(space, '1830 has a $100 par')
        game.act('ParCompany', { companyId: 'BO', marketSpaceId: space.id })
        const company = getCompany(game.state, 'BO')
        expect(company).toMatchObject({
            started: true,
            floated: false,
            parPrice: 100,
            president: { kind: 'player', playerId: owner }
        })
        expect(
            game.state.stockMarket.stacks.find((stack) => stack.spaceId === space.id)?.companyIds
        ).toContain('BO')
        expect(cash(game.state, { kind: 'player', playerId: owner })).toBe(before)
        expect(game.state).not.toHaveProperty('pendingPar')
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.stockRound.number).toBe(1)
        expect(game.state.activePlayerIds).toEqual([game.state.turnManager.turnOrder[0]])
    })
})

describe('B&O private closure', () => {
    it('closes when the B&O railroad buys a train, not when another company does', () => {
        const { game } = auctionToBaltimore()
        game.act('ParCompany', { companyId: 'BO', marketSpaceId: '0:6' })
        const state = structuredClone(game.state)
        for (const account of state.cash) if (account.owner.kind === 'company') account.amount = 200
        const buy = (companyId: string) => {
            const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, '2')
            assert(train, 'The depot has a 2-train')
            applyTrainPurchase(
                state,
                { companyId, trainId: train.id, definitionId: '2', price: 80 },
                EighteenThirtyTrainRules
            )
        }
        buy('PRR')
        expect(getCompany(state, 'BOP').closed).toBeFalsy()
        buy('BO')
        expect(getCompany(state, 'BOP').closed).toBe(true)
        expect(state.certificates.find((item) => item.id === 'BOP:charter')).toMatchObject({
            retired: true
        })
    })
})

describe('Champlain & St. Lawrence', () => {
    const prr = { kind: 'company', companyId: 'PRR' } as const
    const casey = { kind: 'player', playerId: 'casey' } as const

    it('lets its owning company lay on B20 unconnected, besides the ordinary lay', () => {
        const game = play('construction', (state) => {
            givePrivate(state, 'CS', prr)
            givePrivate(state, 'DH', casey)
        })
        const president = game.state.activePlayerIds[0]
        expect(game.valid(president)).toContain('LayPrivateTile')
        const terms = EighteenThirtyPrivatePowerRules.trackTerms(game.state, 'CS', president)
        assert(terms, 'C&StL offers a lay')
        const choice = privateTrackConstruction(game.state, terms, EighteenThirtyTrackRules)
            .choices('B20')
            .find((choice) => choice.definitionId === '18xx:3')
        assert(choice, 'Tile 3 fits Burlington')
        const before = cash(game.state, prr)
        game.act('LayPrivateTile', {
            privateCompanyId: 'CS',
            companyId: 'PRR',
            locationId: 'B20',
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: 0
        })
        expect(game.state.tileInventory.placements.B20?.definitionId).toBe('18xx:3')
        expect(cash(game.state, prr)).toBe(before)
        expect(game.state.trackStep?.lays).toEqual([])
        expect(game.state.usedPrivatePowerIds).toContain('CS')
        expect(game.valid(president)).toContain('LayTile')
        expect(game.valid(president)).not.toContain('LayPrivateTile')
    })

    it('gives a player owner no lay', () => {
        const game = play('construction', (state) => {
            givePrivate(state, 'CS', { kind: 'player', playerId: state.activePlayerIds[0] })
            givePrivate(state, 'DH', casey)
        })
        expect(game.valid(game.state.activePlayerIds[0])).not.toContain('LayPrivateTile')
    })
})

describe('Delaware & Hudson', () => {
    const prr = { kind: 'company', companyId: 'PRR' } as const
    function scranton() {
        const game = play('construction', (state) => givePrivate(state, 'DH', prr))
        const president = game.state.activePlayerIds[0]
        const terms = EighteenThirtyPrivatePowerRules.trackTerms(game.state, 'DH', president)
        assert(terms, 'D&H offers a lay')
        const choice = privateTrackConstruction(game.state, terms, EighteenThirtyTrackRules)
            .choices('F16')
            .find((choice) => choice.definitionId === '18xx:57')
        assert(choice, 'Tile 57 fits Scranton')
        const before = cash(game.state, prr)
        game.act('LayPrivateTile', {
            privateCompanyId: 'DH',
            companyId: 'PRR',
            locationId: 'F16',
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: 120
        })
        return { game, president, before }
    }

    it('lays 57 on F16 as the ordinary lay, then places a free station that is the turn’s', () => {
        const { game, president, before } = scranton()
        expect(cash(game.state, prr)).toBe(before - 120)
        expect(game.state.trackStep?.lays).toEqual([
            { locationId: 'F16', color: 'yellow', cost: 120 }
        ])
        expect(game.state.privateStation).toEqual({
            privateCompanyId: 'DH',
            companyId: 'PRR',
            playerId: president,
            locationId: 'F16'
        })
        expect(game.valid(president)).toEqual(['PlacePrivateStation', 'DeclinePrivateStation'])
        game.act('PlacePrivateStation', {
            privateCompanyId: 'DH',
            position: { locationId: 'F16', nodeId: 'city', slot: 0 }
        })
        expect(cash(game.state, prr)).toBe(before - 120)
        expect(game.state.stations.find((station) => station.id === 'PRR:station:1')).toEqual({
            id: 'PRR:station:1',
            companyId: 'PRR',
            status: 'placed',
            position: { locationId: 'F16', nodeId: 'city', slot: 0 }
        })
        expect(game.state).not.toHaveProperty('privateStation')
        expect(['LayingTrack', 'PlacingStation']).not.toContain(game.state.machineState)
    })

    it('lets the president decline the station', () => {
        const { game, president } = scranton()
        game.act('DeclinePrivateStation', { privateCompanyId: 'DH' })
        expect(game.state).not.toHaveProperty('privateStation')
        expect(
            game.state.stations.some(
                (station) => station.status === 'placed' && station.position.locationId === 'F16'
            )
        ).toBe(false)
        expect(game.valid(president)).not.toContain('PlacePrivateStation')
    })

    it('is not offered after the company’s ordinary lay', () => {
        const game = play('construction', (state) => givePrivate(state, 'DH', prr))
        const president = game.state.activePlayerIds[0]
        const laid = {
            ...game.state,
            trackStep: {
                companyId: 'PRR',
                lays: [{ locationId: 'H14', color: 'yellow', cost: 0 }],
                completed: false
            }
        }
        expect(EighteenThirtyPrivatePowerRules.trackTerms(laid, 'DH', president)).toBeUndefined()
    })
})

describe('Mohawk & Hudson', () => {
    it('exchanges for an NYC share in its owner’s stock turn', () => {
        const game = play('trading', (state) =>
            givePrivate(state, 'MH', { kind: 'player', playerId: 'alex' })
        )
        expect(game.valid('alex')).toContain('ExchangePrivate')
        game.act('ExchangePrivate', { privateCompanyId: 'MH', certificateId: 'NYC:share:4' })
        expect(certificateOwner(game.state, 'NYC:share:4')).toEqual({
            kind: 'player',
            playerId: 'alex'
        })
        expect(getCompany(game.state, 'MH').closed).toBe(true)
    })

    it('exchanges out of turn', () => {
        const game = play('trading', (state) =>
            givePrivate(state, 'MH', { kind: 'player', playerId: 'casey' })
        )
        expect(game.state.activePlayerIds).toEqual(['alex'])
        expect(game.valid('casey')).toContain('ExchangePrivateOutOfTurn')
        game.act(
            'ExchangePrivateOutOfTurn',
            {
                privateCompanyId: 'MH',
                certificateId: 'NYC:share:4',
                outOfTurn: true,
                sequenced: true
            },
            'casey'
        )
        expect(certificateOwner(game.state, 'NYC:share:4')).toEqual({
            kind: 'player',
            playerId: 'casey'
        })
        expect(game.state.activePlayerIds).toEqual(['alex'])
    })
})
