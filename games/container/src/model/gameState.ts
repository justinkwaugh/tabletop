import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    TurnManager,
    assertExists
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ContainerColor } from './container.js'
import {
    DEFAULT_MACHINE_COSTS,
    DEFAULT_WAREHOUSE_COSTS,
    INTEREST_AMOUNT,
    LOAN_AMOUNT,
    MAX_LOANS,
    SHIP_CAPACITY
} from '../definition/constants.js'
import {
    ContainerPlayerState,
    HydratedContainerPlayerState
} from './playerState.js'
import {
    ForeignIslandAuction,
    HydratedForeignIslandAuction
} from '../components/foreignIslandAuction.js'
import { InvestmentBank, type BrokerBidContainer, type PaymentCard } from './investmentBank.js'

export type Supply = Static<typeof Supply>
export const Supply = Type.Object({
    containers: Type.Record(Type.Enum(ContainerColor), Type.Number()),
    machines: Type.Record(Type.Enum(ContainerColor), Type.Number()),
    warehouses: Type.Number()
})

export type SeizureState = Static<typeof SeizureState>
export const SeizureState = Type.Object({
    turnPlayerId: Type.String(),
    chooserId: Type.String(),
    remaining: Type.Number(),
    locationIndex: Type.Number()
})

const SEIZURE_LOCATIONS = ['island', 'ship', 'investment_bank', 'harbor', 'factory'] as const

type SeizureLocation = (typeof SEIZURE_LOCATIONS)[number]

export type ContainerGameState = Static<typeof ContainerGameState>
export const ContainerGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState', 'turnManager', 'result']),
        Type.Object({
            players: Type.Array(ContainerPlayerState),
            machineState: Type.Enum(MachineState),
            turnManager: TurnManager,
            result: Type.Optional(Type.Enum(GameResult)),
            supply: Supply,
            actionsRemaining: Type.Number(),
            producedThisTurn: Type.Boolean(),
            interestPaidThisTurn: Type.Boolean(),
            turnNeedsStart: Type.Boolean(),
            endTriggered: Type.Boolean(),
            auction: Type.Optional(ForeignIslandAuction),
            seizure: Type.Optional(SeizureState),
            investmentBank: Type.Optional(InvestmentBank),
            brokerAuctionWonThisTurn: Type.Boolean(),
            calledBrokerThisTurn: Type.Boolean()
        })
    ])
)

export const ContainerGameStateValidator = Compile(ContainerGameState)

export class HydratedContainerGameState
    extends HydratableGameState<typeof ContainerGameState, HydratedContainerPlayerState>
    implements ContainerGameState
{
    declare systemVersion?: number
    declare id: string
    declare gameId: string
    declare players: HydratedContainerPlayerState[]
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare seed?: number
    declare prng: { seed: number; invocations: number }
    declare machineState: MachineState
    declare turnManager: HydratedTurnManager
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare supply: Supply
    declare actionsRemaining: number
    declare producedThisTurn: boolean
    declare interestPaidThisTurn: boolean
    declare turnNeedsStart: boolean
    declare endTriggered: boolean
    declare auction?: HydratedForeignIslandAuction
    declare seizure?: SeizureState
    declare investmentBank?: InvestmentBank
    declare brokerAuctionWonThisTurn: boolean
    declare calledBrokerThisTurn: boolean

    constructor(data: ContainerGameState) {
        super(data, ContainerGameStateValidator)
        this.players = this.players.map((player) => new HydratedContainerPlayerState(player))
        if (data.auction) {
            this.auction = new HydratedForeignIslandAuction(data.auction)
        }
    }

    override getPlayerState(playerId?: string): HydratedContainerPlayerState {
        assertExists(playerId, 'playerId is required to get player state')
        const player = this.players.find((p) => p.playerId === playerId)
        assertExists(player, `Player state for player ${playerId} not found`)
        return player
    }

    getActivePlayerId(): string {
        const activePlayerId = this.activePlayerIds[0]
        assertExists(activePlayerId, 'Active player not set')
        return activePlayerId
    }

    getRightNeighborId(playerId: string): string {
        const order = this.turnManager.turnOrder
        const index = order.indexOf(playerId)
        if (index === -1) {
            throw new Error('Player not in turn order')
        }
        const rightIndex = (index - 1 + order.length) % order.length
        return order[rightIndex]
    }

    startNextTurn(): void {
        const nextPlayerId = this.turnManager.startNextTurn(this.actionCount)
        this.activePlayerIds = [nextPlayerId]
        this.actionsRemaining = 2
        this.producedThisTurn = false
        this.interestPaidThisTurn = false
        this.brokerAuctionWonThisTurn = false
        this.calledBrokerThisTurn = false
        this.turnNeedsStart = false

        if (this.investmentBank?.paymentCard?.bidderId === nextPlayerId) {
            this.resolveBrokerAuction(nextPlayerId)
            this.brokerAuctionWonThisTurn = true
        }

        const seizure = this.payInterest(nextPlayerId)
        this.interestPaidThisTurn = true

        if (seizure) {
            this.seizure = seizure
            this.activePlayerIds = [seizure.chooserId]
        }
    }

    payInterest(playerId: string): SeizureState | undefined {
        const player = this.getPlayerState(playerId)
        const initialLoans = player.loans
        const required = initialLoans * INTEREST_AMOUNT
        this.ensureCash(player, required)

        const payable = Math.min(player.money, required)
        player.money -= payable
        if (this.investmentBank) {
            let remaining = payable
            for (let loanIndex = 0; loanIndex < initialLoans && remaining > 0; loanIndex++) {
                const broker = this.investmentBank.brokers[loanIndex]
                if (broker) {
                    broker.money += 1
                }
                remaining -= 1
            }
        }

        const unpaidAmount = required - payable
        if (unpaidAmount <= 0) {
            return undefined
        }

        const unpaidLoans = Math.ceil(unpaidAmount / INTEREST_AMOUNT)
        if (!this.hasSeizableContainers(player)) {
            return undefined
        }

        const chooserId = this.getRightNeighborId(playerId)
        return {
            turnPlayerId: playerId,
            chooserId,
            remaining: unpaidLoans,
            locationIndex: 0
        }
    }

    ensureCash(player: HydratedContainerPlayerState, amount: number): void {
        while (player.money < amount && player.loans < MAX_LOANS) {
            player.loans += 1
            player.money += LOAN_AMOUNT
        }
    }

    applySeizureChoice(color: ContainerColor): void {
        const seizure = this.seizure
        assertExists(seizure, 'No seizure in progress')

        const player = this.getPlayerState(seizure.turnPlayerId)
        const location = this.nextSeizureLocation(player, seizure)
        if (!location) {
            this.clearSeizure()
            return
        }

        const removed = this.removeSeizedContainer(player, location, color)
        if (!removed) {
            throw new Error('Selected container color is not available to seize')
        }

        seizure.remaining -= 1
        if (seizure.remaining <= 0 || !this.hasSeizableContainers(player)) {
            this.clearSeizure()
            return
        }

        const nextLocation = this.nextSeizureLocation(player, seizure)
        if (!nextLocation) {
            this.clearSeizure()
        }
    }

    clearSeizure(): void {
        const seizure = this.seizure
        if (!seizure) {
            return
        }
        this.seizure = undefined
        this.activePlayerIds = [seizure.turnPlayerId]
    }

    canEndGame(): boolean {
        const emptyColors = Object.values(this.supply.containers).filter((count) => count <= 0)
        return emptyColors.length >= 2
    }

    checkEndCondition(): void {
        if (!this.endTriggered && this.canEndGame()) {
            this.endTriggered = true
        }
    }

    getMachineCost(machineCount: number): number {
        const index = machineCount - 1
        const cost = DEFAULT_MACHINE_COSTS[index]
        if (cost === undefined) {
            throw new Error('No machine cost available for this slot')
        }
        return cost
    }

    getWarehouseCost(warehouseCount: number): number {
        const index = warehouseCount - 1
        const cost = DEFAULT_WAREHOUSE_COSTS[index]
        if (cost === undefined) {
            throw new Error('No warehouse cost available for this slot')
        }
        return cost
    }

    shipCapacity(): number {
        return SHIP_CAPACITY
    }

    recordAction(action: GameAction): void {
        super.recordAction(action)
    }

    private hasSeizableContainers(player: HydratedContainerPlayerState): boolean {
        return (
            player.island.length > 0 ||
            player.ship.cargo.length > 0 ||
            (this.investmentBank?.personalHarbors[player.playerId]?.length ?? 0) > 0 ||
            player.harborStore.length > 0 ||
            player.factoryStore.length > 0
        )
    }

    private nextSeizureLocation(
        player: HydratedContainerPlayerState,
        seizure: SeizureState
    ): SeizureLocation | undefined {
        while (seizure.locationIndex < SEIZURE_LOCATIONS.length) {
            const location = SEIZURE_LOCATIONS[seizure.locationIndex]
            if (this.locationHasContainers(player, location)) {
                return location
            }
            seizure.locationIndex += 1
        }
        return undefined
    }

    private locationHasContainers(
        player: HydratedContainerPlayerState,
        location: SeizureLocation
    ): boolean {
        switch (location) {
            case 'island':
                return player.island.length > 0
            case 'ship':
                return player.ship.cargo.length > 0
            case 'investment_bank':
                return (this.investmentBank?.personalHarbors[player.playerId]?.length ?? 0) > 0
            case 'harbor':
                return player.harborStore.length > 0
            case 'factory':
                return player.factoryStore.length > 0
        }
    }

    private removeSeizedContainer(
        player: HydratedContainerPlayerState,
        location: SeizureLocation,
        color: ContainerColor
    ): boolean {
        switch (location) {
            case 'island': {
                const index = player.island.indexOf(color)
                if (index < 0) {
                    return false
                }
                player.island.splice(index, 1)
                return true
            }
            case 'ship': {
                const index = player.ship.cargo.indexOf(color)
                if (index < 0) {
                    return false
                }
                player.ship.cargo.splice(index, 1)
                return true
            }
            case 'investment_bank': {
                const bank = this.investmentBank
                if (!bank) {
                    return false
                }
                const personalHarbor = bank.personalHarbors[player.playerId]
                if (!personalHarbor) {
                    return false
                }
                const index = personalHarbor.indexOf(color)
                if (index < 0) {
                    return false
                }
                personalHarbor.splice(index, 1)
                return true
            }
            case 'harbor': {
                const index = player.harborStore.findIndex((entry) => entry.color === color)
                if (index < 0) {
                    return false
                }
                player.harborStore.splice(index, 1)
                return true
            }
            case 'factory': {
                const index = player.factoryStore.findIndex((entry) => entry.color === color)
                if (index < 0) {
                    return false
                }
                player.factoryStore.splice(index, 1)
                return true
            }
        }
    }

    getBrokerReservedCount(playerId: string, source?: 'factory' | 'harbor'): number {
        const payment = this.investmentBank?.paymentCard
        if (!payment || payment.bidderId !== playerId || payment.bidType !== 'containers') {
            return 0
        }
        const bidContainers = payment.bidContainers ?? []
        if (!source) {
            return bidContainers.length
        }
        return bidContainers.filter((entry) => entry.source === source).length
    }

    extractBidContainers(
        playerId: string,
        factoryIndices: number[],
        harborIndices: number[]
    ): BrokerBidContainer[] {
        const player = this.getPlayerState(playerId)

        const uniqueFactory = new Set(factoryIndices)
        if (uniqueFactory.size !== factoryIndices.length) {
            throw new Error('Duplicate factory indices')
        }
        const uniqueHarbor = new Set(harborIndices)
        if (uniqueHarbor.size !== harborIndices.length) {
            throw new Error('Duplicate harbor indices')
        }

        const factoryMax = player.factoryStore.length - 1
        for (const index of factoryIndices) {
            if (index < 0 || index > factoryMax) {
                throw new Error('Factory index out of bounds')
            }
        }

        const harborMax = player.harborStore.length - 1
        for (const index of harborIndices) {
            if (index < 0 || index > harborMax) {
                throw new Error('Harbor index out of bounds')
            }
        }

        const factoryEntries = factoryIndices.map((index) => player.factoryStore[index])
        const harborEntries = harborIndices.map((index) => player.harborStore[index])

        const factoryBid: BrokerBidContainer[] = factoryEntries.map((entry) => ({
            color: entry.color,
            price: entry.price,
            source: 'factory'
        }))
        const harborBid: BrokerBidContainer[] = harborEntries.map((entry) => ({
            color: entry.color,
            price: entry.price,
            source: 'harbor'
        }))

        const factoryRemove = [...factoryIndices].sort((a, b) => b - a)
        for (const index of factoryRemove) {
            player.factoryStore.splice(index, 1)
        }

        const harborRemove = [...harborIndices].sort((a, b) => b - a)
        for (const index of harborRemove) {
            player.harborStore.splice(index, 1)
        }

        return [...factoryBid, ...harborBid]
    }

    refundBrokerBid(payment: PaymentCard): void {
        const player = this.getPlayerState(payment.bidderId)
        if (payment.bidType === 'money') {
            player.money += payment.bidAmount
            return
        }

        const bidContainers = payment.bidContainers ?? []
        if (bidContainers.length === 0) {
            return
        }

        for (const entry of bidContainers) {
            if (entry.source === 'factory') {
                player.factoryStore.push({ color: entry.color, price: entry.price })
            } else {
                player.harborStore.push({ color: entry.color, price: entry.price })
            }
        }
    }

    resolveBrokerAuction(playerId: string): void {
        const bank = this.investmentBank
        assertExists(bank, 'Investment Bank not enabled')

        const payment = bank.paymentCard
        assertExists(payment, 'No broker auction to resolve')
        assertExists(payment.bidderId, 'Payment card missing bidder')
        if (payment.bidderId !== playerId) {
            throw new Error('Only the winning bidder can resolve the broker auction')
        }

        const broker = bank.brokers[payment.brokerIndex]
        assertExists(broker, 'Broker not found')

        const player = this.getPlayerState(playerId)
        if (payment.offerType === 'money') {
            if (broker.money > 0) {
                player.money += broker.money
                broker.money = 0
            }
        } else {
            if (broker.containers.length > 0) {
                const personalHarbor = bank.personalHarbors[playerId] ?? []
                personalHarbor.push(...broker.containers)
                bank.personalHarbors[playerId] = personalHarbor
                broker.containers = []
            }
        }

        if (payment.bidType === 'money') {
            this.depositToInvestmentBank(payment.bidAmount)
        } else {
            const bidContainers = payment.bidContainers ?? []
            this.depositContainersToInvestmentBank(bidContainers.map((entry) => entry.color))
        }

        bank.paymentCard = undefined
    }

    depositToInvestmentBank(amount: number): void {
        const bank = this.investmentBank
        if (!bank || amount <= 0) {
            return
        }
        for (let index = 0; index < amount; index += 1) {
            const broker = bank.brokers[index % bank.brokers.length]
            broker.money += 1
        }
    }

    depositContainersToInvestmentBank(containers: ContainerColor[]): void {
        const bank = this.investmentBank
        if (!bank || containers.length === 0) {
            return
        }
        containers.forEach((color, index) => {
            const broker = bank.brokers[index % bank.brokers.length]
            broker.containers.push(color)
        })
    }
}
