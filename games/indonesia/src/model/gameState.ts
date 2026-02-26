import {
    assert,
    assertExists,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedTurnManager,
    PhaseManager,
    PrngState
} from '@tabletop/common'
import { IndonesiaPlayerState, HydratedIndonesiaPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { IndonesiaBoard, HydratedIndonesiaBoard } from '../components/board.js'
import { AnyDeed } from '../components/deed.js'
import { Era } from '../definition/eras.js'
import { CityCard } from '../components/cards.js'
import { City } from '../components/city.js'
import {
    Company,
    isProductionCompany,
    isShippingCompany,
    type ProductionCompany,
    type ShippingCompany
} from '../components/company.js'
import { isCultivatedArea, isSeaArea, type SeaArea } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good, isGood } from '../definition/goods.js'
import {
    IndonesiaAreaType,
    IndonesiaNeighborDirection,
    isIndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import { DeliveryPlanSchema, type DeliveryPlan } from '../operations/deliveryPlan.js'

export type TurnOrderBid = Type.Static<typeof TurnOrderBid>
export const TurnOrderBid = Type.Object({
    bid: Type.Number(),
    multiplier: Type.Number(),
    total: Type.Number()
})

export type IndonesiaGameState = Type.Static<typeof IndonesiaGameState>
export const IndonesiaGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(IndonesiaPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            phaseManager: PhaseManager,
            board: IndonesiaBoard,
            availableDeeds: Type.Array(AnyDeed),
            availableCities: Type.Object({
                size1: Type.Number(),
                size2: Type.Number(),
                size3: Type.Number()
            }),
            turnOrderBids: Type.Optional(Type.Record(Type.String(), TurnOrderBid)), // Map of playerId to their turn order bid
            era: Type.Enum(Era),
            currentCityCard: Type.Optional(CityCard), // The city card currently being placed in the New Era phase
            placingCities: Type.Array(Type.String()), // List of players remaining to place cities
            companies: Type.Array(Company), // List of companies in the game
            operatingCompanyId: Type.Optional(Type.String()), // Company currently being operated in operations sub-states
            operatingCompanyExpansionCount: Type.Optional(Type.Number()), // Number of expansions performed during current company operation
            operatingCompanyDeliveryPlan: Type.Optional(DeliveryPlanSchema), // Delivery plan for the currently operating production company
            operatedCompanyIds: Type.Array(Type.String()) // Companies that have already operated this operations phase
        })
    ])
)

const IndonesiaGameStateValidator = Compile(IndonesiaGameState)

export class HydratedIndonesiaGameState
    extends HydratableGameState<typeof IndonesiaGameState, HydratedIndonesiaPlayerState>
    implements IndonesiaGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedIndonesiaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare phaseManager: HydratedPhaseManager
    declare machineState: MachineState
    declare board: HydratedIndonesiaBoard
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare availableDeeds: AnyDeed[]
    declare availableCities: {
        size1: number
        size2: number
        size3: number
    }
    declare turnOrderBids?: Record<string, TurnOrderBid>
    declare era: Era
    declare currentCityCard: CityCard | undefined
    declare placingCities: string[]
    declare companies: Company[]
    declare operatingCompanyId?: string
    declare operatingCompanyExpansionCount?: number
    declare operatingCompanyDeliveryPlan?: DeliveryPlan
    declare operatedCompanyIds: string[]

    constructor(data: IndonesiaGameState) {
        super(data, IndonesiaGameStateValidator)

        this.players = data.players.map((player) => new HydratedIndonesiaPlayerState(player))
        this.board = new HydratedIndonesiaBoard(data.board)
        this.phaseManager = new HydratedPhaseManager(data.phaseManager)
    }

    public hasCompanyOperated(companyId: string): boolean {
        return this.operatedCompanyIds.includes(companyId)
    }

    public canPlayerOperateAnyCompany(playerId: string): boolean {
        return this.companies.some(
            (company) => company.owner === playerId && !this.hasCompanyOperated(company.id)
        )
    }

    public beginCompanyOperation(companyId: string): void {
        this.operatingCompanyId = companyId
        this.operatingCompanyExpansionCount = 0
        this.clearOperatingCompanyDeliveryPlan()
    }

    public clearOperatingCompany(): void {
        this.operatingCompanyId = undefined
        this.operatingCompanyExpansionCount = undefined
        this.clearOperatingCompanyDeliveryPlan()
    }

    public setOperatingCompanyDeliveryPlan(deliveryPlan: DeliveryPlan): void {
        const operatingCompanyId = this.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set before storing operating company delivery plan'
        )
        assert(
            deliveryPlan.operatingCompanyId === operatingCompanyId,
            `Delivery plan company ${deliveryPlan.operatingCompanyId} should match operating company ${operatingCompanyId}`
        )

        this.operatingCompanyDeliveryPlan = deliveryPlan
    }

    public clearOperatingCompanyDeliveryPlan(): void {
        this.operatingCompanyDeliveryPlan = undefined
    }

    public resetOperationsTracking(): void {
        this.operatedCompanyIds = []
        this.clearOperatingCompany()
    }

    public markOperatingCompanyAsOperated(): void {
        const operatingCompanyId = this.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set before marking company as operated'
        )
        assert(
            !this.operatedCompanyIds.includes(operatingCompanyId),
            `Operating company ${operatingCompanyId} was already marked as operated`
        )
        this.operatedCompanyIds.push(operatingCompanyId)
        this.clearOperatingCompany()
    }

    public incrementOperatingCompanyExpansionCount(): void {
        const operatingCompanyId = this.operatingCompanyId
        assertExists(
            operatingCompanyId,
            'Operating company id should be set before incrementing expansion count'
        )
        this.operatingCompanyExpansionCount = (this.operatingCompanyExpansionCount ?? 0) + 1
    }

    public canCurrentOperationExpandForPlayer(playerId: string): boolean {
        const playerState = this.getPlayerState(playerId)
        const expansionLimit = playerState.research.expansion + 1
        const expansionCount = this.operatingCompanyExpansionCount ?? 0
        return expansionCount < expansionLimit
    }

    public resetCityDemandsForOperationsPhase(): void {
        for (const city of this.board.cities) {
            city.demand = {}
        }
    }

    public producedGoodsOnBoard(): Set<Good> {
        const goods = new Set<Good>()
        for (const area of Object.values(this.board.areas)) {
            if (!isCultivatedArea(area)) {
                continue
            }
            assert(isGood(area.good), `Cultivated area ${area.id} has an invalid good value`)
            goods.add(area.good)
        }

        return goods
    }

    public isGoodProducedOnBoard(good: Good): boolean {
        return this.producedGoodsOnBoard().has(good)
    }

    public currentCityDemandForGood(city: City, good: Good): number {
        return city.demand[good] ?? 0
    }

    public remainingCityDemandForGood(city: City, good: Good): number {
        if (!this.isGoodProducedOnBoard(good)) {
            return 0
        }

        return Math.max(0, city.size - this.currentCityDemandForGood(city, good))
    }

    public canCityAcceptGood(city: City, good: Good): boolean {
        return this.remainingCityDemandForGood(city, good) > 0
    }

    public recordCityGoodDelivery(cityId: string, good: Good, quantity: number): void {
        assert(Number.isInteger(quantity), 'Delivery quantity must be an integer')
        assert(quantity > 0, 'Delivery quantity must be positive')

        const city = this.board.cities.find((entry) => entry.id === cityId)
        assertExists(city, `City ${cityId} should exist before recording delivery`)

        const remainingDemand = this.remainingCityDemandForGood(city, good)
        assert(
            quantity <= remainingDemand,
            `Delivery quantity ${quantity} exceeds remaining demand ${remainingDemand} for city ${cityId} and good ${good}`
        )

        city.demand[good] = this.currentCityDemandForGood(city, good) + quantity
    }

    public canCompanyExpand(companyId: string): boolean {
        for (const _ of this.validExpansionAreaIds(companyId)) {
            return true
        }

        return false
    }

    public canCompanyExpandToArea(companyId: string, areaId: string): boolean {
        assert(isIndonesiaNodeId(areaId), `Invalid area id ${areaId} is not a valid Indonesia node id`)

        const company = this.companies.find((entry) => entry.id === companyId)
        assertExists(company, `Company with id ${companyId} was not found`)

        if (isShippingCompany(company)) {
            return this.canShippingCompanyExpandToArea(company, areaId)
        }

        if (isProductionCompany(company)) {
            return this.canProductionCompanyExpandToArea(company, areaId)
        }

        assert(false, `Unsupported company type for company ${companyId}`)
    }

    public *validExpansionAreaIds(companyId: string): Generator<string, void, undefined> {
        const company = this.companies.find((entry) => entry.id === companyId)
        assertExists(company, `Company with id ${companyId} was not found`)

        if (isShippingCompany(company)) {
            yield* this.shippingExpansionAreaIds(company)
            return
        }

        if (isProductionCompany(company)) {
            yield* this.productionExpansionAreaIds(company)
            return
        }

        assert(false, `Unsupported company type for company ${companyId}`)
    }

    private canShippingCompanyExpand(company: ShippingCompany): boolean {
        const allowedShipCountForEra = this.shippingCapacityForEra(company)
        if (allowedShipCountForEra <= 0) {
            return false
        }

        let currentShipCount = 0
        for (const area of Object.values(this.board.areas)) {
            if (!isSeaArea(area)) {
                continue
            }
            for (const shipCompanyId of area.ships) {
                if (shipCompanyId === company.id) {
                    currentShipCount += 1
                }
            }
        }

        return currentShipCount < allowedShipCountForEra
    }

    private *shippingExpansionAreaIds(
        company: ShippingCompany
    ): Generator<string, void, undefined> {
        if (!this.canShippingCompanyExpand(company)) {
            return
        }

        for (const node of this.board) {
            if (node.type !== IndonesiaAreaType.Sea) {
                continue
            }
            if (this.canShippingCompanyExpandToArea(company, node.id)) {
                yield node.id
            }
        }
    }

    private canShippingCompanyExpandToArea(company: ShippingCompany, areaId: string): boolean {
        if (!this.canShippingCompanyExpand(company)) {
            return false
        }

        const candidateArea = this.board.getArea(areaId)
        if (!isSeaArea(candidateArea)) {
            return false
        }
        if (this.seaAreaHasCompanyShip(candidateArea, company.id)) {
            return false
        }

        const candidateNode = this.board.getNodeForArea(candidateArea)
        for (const neighborNode of this.board.graph.neighborsOf(
            candidateNode,
            IndonesiaNeighborDirection.Sea
        )) {
            const neighborArea = this.board.getArea(neighborNode.id)
            if (!isSeaArea(neighborArea)) {
                continue
            }
            if (this.seaAreaHasCompanyShip(neighborArea, company.id)) {
                return true
            }
        }

        return false
    }

    private seaAreaHasCompanyShip(area: SeaArea, companyId: string): boolean {
        return area.ships.some((shipCompanyId) => shipCompanyId === companyId)
    }

    private shippingCapacityForEra(company: ShippingCompany): number {
        let capacity = 0
        for (const deed of company.deeds) {
            if (deed.type !== CompanyType.Shipping) {
                continue
            }
            capacity += deed.sizes[this.era] ?? 0
        }
        return capacity
    }

    private canProductionCompanyExpand(company: ProductionCompany): boolean {
        for (const _ of this.productionExpansionAreaIds(company)) {
            return true
        }

        return false
    }

    private *productionExpansionAreaIds(
        company: ProductionCompany
    ): Generator<string, void, undefined> {
        for (const node of this.board) {
            if (node.type !== IndonesiaAreaType.Land) {
                continue
            }
            if (this.canProductionCompanyExpandToArea(company, node.id)) {
                yield node.id
            }
        }
    }

    private canProductionCompanyExpandToArea(
        company: ProductionCompany,
        areaId: string
    ): boolean {
        const candidateArea = this.board.getArea(areaId)
        if (!this.board.canBeNewlyCultivated(candidateArea, company.good, company.id)) {
            return false
        }

        const candidateNode = this.board.getNodeForArea(candidateArea)
        for (const neighborNode of this.board.graph.neighborsOf(
            candidateNode,
            IndonesiaNeighborDirection.Land
        )) {
            const neighborArea = this.board.getArea(neighborNode.id)
            if (!isCultivatedArea(neighborArea)) {
                continue
            }
            if (neighborArea.companyId === company.id) {
                return true
            }
        }

        return false
    }
}
