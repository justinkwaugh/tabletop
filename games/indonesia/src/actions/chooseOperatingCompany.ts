import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type ChooseOperatingCompanyMetadata = Type.Static<typeof ChooseOperatingCompanyMetadata>
export const ChooseOperatingCompanyMetadata = Type.Object({})

export type ChooseOperatingCompany = Type.Static<typeof ChooseOperatingCompany>
export const ChooseOperatingCompany = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseOperatingCompany),
            playerId: Type.String(),
            metadata: Type.Optional(ChooseOperatingCompanyMetadata),
            companyId: Type.String()
        })
    ])
)

export const ChooseOperatingCompanyValidator = Compile(ChooseOperatingCompany)

export function isChooseOperatingCompany(action?: GameAction): action is ChooseOperatingCompany {
    return action?.type === ActionType.ChooseOperatingCompany
}

export class HydratedChooseOperatingCompany
    extends HydratableAction<typeof ChooseOperatingCompany>
    implements ChooseOperatingCompany
{
    declare type: ActionType.ChooseOperatingCompany
    declare playerId: string
    declare metadata?: ChooseOperatingCompanyMetadata
    declare companyId: string

    constructor(data: ChooseOperatingCompany) {
        super(data, ChooseOperatingCompanyValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidChooseOperatingCompany(state)) {
            throw Error('Invalid ChooseOperatingCompany action')
        }

        state.beginCompanyOperation(this.companyId)
        this.metadata = {}
    }

    isValidChooseOperatingCompany(state: HydratedIndonesiaGameState): boolean {
        if (!HydratedChooseOperatingCompany.canChooseOperatingCompany(state, this.playerId)) {
            return false
        }
        return HydratedChooseOperatingCompany.canChooseSpecificCompany(
            state,
            this.playerId,
            this.companyId
        )
    }

    static canChooseOperatingCompany(state: HydratedIndonesiaGameState, playerId: string): boolean {
        if (state.machineState !== MachineState.Operations) {
            return false
        }
        if (state.operatingCompanyId) {
            return false
        }
        return state.canPlayerOperateAnyCompany(playerId)
    }

    static canChooseSpecificCompany(
        state: HydratedIndonesiaGameState,
        playerId: string,
        companyId: string
    ): boolean {
        const company = state.companies.find((entry) => entry.id === companyId)
        if (!company) {
            return false
        }
        if (company.owner !== playerId) {
            return false
        }

        return !state.hasCompanyOperated(company.id)
    }
}
