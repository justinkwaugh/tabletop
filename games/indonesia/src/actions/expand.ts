import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isProductionCompany, isShippingCompany } from '../components/company.js'
import { AreaType, isEmptyLandArea, isSeaArea } from '../components/area.js'
import {
    canAnyProductionExpansionBeApplied,
    describeProductionOperation,
    ProductionOperationStage
} from '../operations/productionOperationProgress.js'

export type ExpandMetadata = Type.Static<typeof ExpandMetadata>
export const ExpandMetadata = Type.Object({
    cost: Type.Number()
})

export type Expand = Type.Static<typeof Expand>
export const Expand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Expand),
            playerId: Type.String(),
            metadata: Type.Optional(ExpandMetadata),
            areaId: Type.String() // The ID of the area where the expansion is being placed
        })
    ])
)

export const ExpandValidator = Compile(Expand)

export function isExpand(action?: GameAction): action is Expand {
    return action?.type === ActionType.Expand
}

export class HydratedExpand extends HydratableAction<typeof Expand> implements Expand {
    declare type: ActionType.Expand
    declare playerId: string
    declare metadata?: ExpandMetadata
    declare areaId: string

    constructor(data: Expand) {
        super(data, ExpandValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidExpand(state)) {
            throw Error('Invalid Expand action')
        }

        const operatingCompanyId = state.operatingCompanyId
        assertExists(operatingCompanyId, 'Operating company id should be set for Expand action')

        const operatingCompany = state.companies.find((company) => company.id === operatingCompanyId)
        assertExists(operatingCompany, `Operating company ${operatingCompanyId} should exist`)

        if (isShippingCompany(operatingCompany)) {
            const seaArea = state.board.getArea(this.areaId)
            assert(isSeaArea(seaArea), `Area with id ${this.areaId} is not a sea area`)
            seaArea.ships.push(operatingCompany.id)
            state.board.areas[seaArea.id] = seaArea
            state.incrementOperatingCompanyExpansionCount()
            this.metadata = {
                cost: 0
            }
            return
        }

        if (isProductionCompany(operatingCompany)) {
            const productionProgress = describeProductionOperation(state)
            assertExists(
                productionProgress,
                'Production operation context should exist for production expansion'
            )
            assert(
                productionProgress.operatingCompanyId === operatingCompany.id,
                `Production operation company ${productionProgress.operatingCompanyId} should match operating company ${operatingCompany.id}`
            )
            assert(
                productionProgress.stage !== ProductionOperationStage.Delivery,
                'Production expansion cannot be applied before required deliveries are completed'
            )

            const targetArea = state.board.getArea(this.areaId)
            assert(
                isEmptyLandArea(targetArea),
                `Area with id ${this.areaId} should be empty land for production expansion`
            )
            state.board.areas[targetArea.id] = {
                id: targetArea.id,
                type: AreaType.Cultivated,
                companyId: operatingCompany.id,
                good: operatingCompany.good
            }

            const expansionCost = productionProgress.expansionCostPerArea
            if (expansionCost > 0) {
                const ownerState = state.getPlayerState(operatingCompany.owner)
                assert(
                    ownerState.cash >= expansionCost,
                    `Player ${operatingCompany.owner} cannot pay expansion cost ${expansionCost}`
                )
                ownerState.cash -= expansionCost
            }

            state.incrementOperatingCompanyExpansionCount()
            this.metadata = {
                cost: expansionCost
            }
            return
        }

        assert(false, 'Unsupported operating company type for Expand action')
    }

    isValidExpand(state: HydratedIndonesiaGameState): boolean {
        return HydratedExpand.canExpand(state, this.playerId, this.areaId)
    }

    static canExpand(state: HydratedIndonesiaGameState, playerId: string, areaId?: string): boolean {
        if (
            state.machineState !== MachineState.ShippingOperations &&
            state.machineState !== MachineState.ProductionOperations
        ) {
            return false
        }

        const operatingCompanyId = state.operatingCompanyId
        if (!operatingCompanyId) {
            return false
        }

        const operatingCompany = state.companies.find(
            (company) => company.id === operatingCompanyId
        )
        if (!operatingCompany) {
            return false
        }

        if (operatingCompany.owner !== playerId) {
            return false
        }

        if (isShippingCompany(operatingCompany)) {
            if (!state.canCurrentOperationExpandForPlayer(playerId)) {
                return false
            }
            if (areaId !== undefined) {
                return state.canCompanyExpandToArea(operatingCompany.id, areaId)
            }

            return state.canCompanyExpand(operatingCompany.id)
        }

        if (isProductionCompany(operatingCompany)) {
            const productionProgress = describeProductionOperation(state)
            if (!productionProgress) {
                return false
            }
            if (productionProgress.ownerPlayerId !== playerId) {
                return false
            }
            if (productionProgress.stage === ProductionOperationStage.Delivery) {
                return false
            }
            if (!state.canCurrentOperationExpandForPlayer(playerId)) {
                return false
            }
            if (!canAnyProductionExpansionBeApplied(state, playerId)) {
                return false
            }

            if (areaId !== undefined) {
                return state.canCompanyExpandToArea(operatingCompany.id, areaId)
            }

            return state.canCompanyExpand(operatingCompany.id)
        }

        return false
    }
}
