import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    assert
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../components/companies.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export type CubeFeePaid = Type.Static<typeof CubeFeePaid>
export const CubeFeePaid = Type.Object({
    companyId: Type.Enum(CompanyId),
    amount: Type.Number()
})

export type BuildNetworkMetadata = Type.Static<typeof BuildNetworkMetadata>
export const BuildNetworkMetadata = Type.Object({
    bank: Type.Number(),
    fees: Type.Array(CubeFeePaid),
    waived: Type.Number()
})

export type BuildNetwork = Type.Static<typeof BuildNetwork>
export const BuildNetwork = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildNetwork),
            playerId: Type.String(),
            metadata: Type.Optional(BuildNetworkMetadata),
            companyId: Type.Enum(CompanyId),
            hexes: Type.Array(AxialCoordinates, { minItems: 1, maxItems: 3 })
        })
    ])
)

export const BuildNetworkValidator = Compile(BuildNetwork)

export function isBuildNetwork(action?: GameAction): action is BuildNetwork {
    return action?.type === ActionType.BuildNetwork
}

export class HydratedBuildNetwork
    extends HydratableAction<typeof BuildNetwork>
    implements BuildNetwork
{
    declare type: ActionType.BuildNetwork
    declare playerId: string
    declare metadata?: BuildNetworkMetadata
    declare companyId: CompanyId
    declare hexes: AxialCoordinates[]

    constructor(data: BuildNetwork) {
        super(data, BuildNetworkValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        if (state.bonusCube) {
            assert(
                state.bonusCube.playerId === this.playerId &&
                    this.companyId === CompanyId.Streamside &&
                    this.hexes.length === 1,
                'The bonus is one Streamside Sisters cube'
            )
        } else {
            assert(
                state.buildableCompanies(this.playerId).includes(this.companyId),
                'You cannot build for this company'
            )
        }
        assert(state.isLegalBuild(this.companyId, this.hexes), 'Those cubes cannot be placed')
        const cost = state.buildCost(this.companyId, this.hexes)
        state.company(this.companyId).treasury -= cost.total
        for (const fee of cost.fees) {
            state.company(fee.companyId).treasury += fee.amount
        }
        for (const coords of this.hexes) {
            state.cubes.push({ coords, companyId: this.companyId })
        }
        this.metadata = { bank: cost.bank, fees: cost.fees, waived: cost.waived }
    }

    static canBuild(state: HydratedHcgGameState, playerId: string): boolean {
        if (state.bonusCube) {
            return state.bonusCube.playerId === playerId
        }
        return state.buildableCompanies(playerId).length > 0
    }
}
