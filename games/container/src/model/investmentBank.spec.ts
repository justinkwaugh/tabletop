import { describe, expect, it } from 'vitest'
import { ContainerColor } from './container.js'
import { HydratedForeignIslandAuction } from '../components/foreignIslandAuction.js'
import { HydratedResolveAuction, ResolveAuction } from '../actions/resolveAuction.js'
import { HydratedSailShip, SailShip } from '../actions/sailShip.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'

describe('Investment Bank', () => {
    it('pays interest to brokers in order', () => {
        const state = createTestGameState()
        const player = state.players[0]
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        player.money = 5
        player.loans = 2

        const before = bank.brokers.map((broker) => broker.money)
        const seizure = state.payInterest(player.playerId)

        expect(seizure).toBeUndefined()
        expect(player.money).toBe(3)
        expect(bank.brokers.map((broker) => broker.money)).toEqual([
            before[0] + 1,
            before[1] + 1,
            before[2]
        ])
    })

    it('resolves broker auction by awarding money and depositing container bids', () => {
        const state = createTestGameState()
        const player = state.players[0]
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        bank.brokers = [
            { containers: [], money: 2 },
            { containers: [], money: 0 },
            { containers: [], money: 0 }
        ]
        bank.personalHarbors[player.playerId] = []

        player.money = 0
        bank.paymentCard = {
            bidderId: player.playerId,
            brokerIndex: 0,
            offerType: 'money',
            bidType: 'containers',
            bidAmount: 2,
            bidContainers: [
                { color: ContainerColor.Blue, price: 2, source: 'factory' },
                { color: ContainerColor.Red, price: 3, source: 'harbor' }
            ]
        }

        state.resolveBrokerAuction(player.playerId)

        expect(player.money).toBe(2)
        expect(bank.brokers[0].money).toBe(0)
        expect(bank.brokers[0].containers).toEqual([ContainerColor.Blue])
        expect(bank.brokers[1].containers).toEqual([ContainerColor.Red])
        expect(bank.paymentCard).toBeUndefined()
    })

    it('declining an island auction pays the subsidy to the investment bank', () => {
        const state = createTestGameState()
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        bank.brokers = [
            { containers: [], money: 1 },
            { containers: [], money: 2 },
            { containers: [], money: 3 }
        ]

        const seller = state.players[0]
        seller.money = 5
        seller.ship.cargo = [ContainerColor.Blue]

        const bidderIds = state.players.slice(1).map((player) => player.playerId)
        const round = HydratedForeignIslandAuction.createRound(
            bidderIds,
            seller.playerId,
            'auction-1'
        )

        state.auction = new HydratedForeignIslandAuction({
            sellerId: seller.playerId,
            containers: [...seller.ship.cargo],
            phase: 'initial',
            round: round.dehydrate(),
            totalBids: {},
            winningBid: 2,
            winningBidderId: bidderIds[0],
            tiedPlayerIds: undefined
        })

        const action = new HydratedResolveAuction({
            ...createActionBase(ResolveAuction, state),
            playerId: seller.playerId,
            accept: false
        })

        action.apply(state)

        expect(bank.brokers.map((broker) => broker.money)).toEqual([2, 3, 3])
        expect(state.auction).toBeUndefined()
        expect(seller.ship.cargo).toEqual([])
    })

    it('sailing to the investment bank loads containers from the personal harbor', () => {
        const state = createTestGameState()
        const bank = state.investmentBank
        expect(bank).toBeDefined()
        if (!bank) {
            return
        }

        const player = state.players[0]
        bank.personalHarbors[player.playerId] = [
            ContainerColor.Blue,
            ContainerColor.Red
        ]
        player.ship.location = { type: 'open_sea' }

        const action = new HydratedSailShip({
            ...createActionBase(SailShip, state),
            playerId: player.playerId,
            destination: { type: 'investment_bank' },
            pickupIndices: [0, 1]
        })

        action.apply(state)

        expect(player.ship.location.type).toBe('investment_bank')
        expect(player.ship.cargo).toEqual([ContainerColor.Blue, ContainerColor.Red])
        expect(bank.personalHarbors[player.playerId]).toEqual([])
    })
})
