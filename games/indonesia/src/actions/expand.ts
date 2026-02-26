import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isShippingCompany } from '../components/company.js'
import { isSeaArea } from '../components/area.js'

export type ExpandMetadata = Type.Static<typeof ExpandMetadata>
export const ExpandMetadata = Type.Object({})

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
        }

        this.metadata = {}
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

        if (!state.canCurrentOperationExpandForPlayer(playerId)) {
            return false
        }

        if (areaId !== undefined) {
            return state.canCompanyExpandToArea(operatingCompany.id, areaId)
        }

        return state.canCompanyExpand(operatingCompany.id)
    }
}
