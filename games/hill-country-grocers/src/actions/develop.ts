import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CompanyId } from '../components/companies.js'
import type { HydratedHcgGameState } from '../model/gameState.js'

export type DevelopMetadata = Type.Static<typeof DevelopMetadata>
export const DevelopMetadata = Type.Object({
    paidCompanyIds: Type.Array(Type.Enum(CompanyId))
})

export type Develop = Type.Static<typeof Develop>
export const Develop = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Develop),
            playerId: Type.String(),
            metadata: Type.Optional(DevelopMetadata),
            cityId: Type.String(),
            // Chosen only when Balcones Builders cannot pay every grocer in the city.
            payeeIds: Type.Optional(Type.Array(Type.Enum(CompanyId)))
        })
    ])
)

export const DevelopValidator = Compile(Develop)

export function isDevelop(action?: GameAction): action is Develop {
    return action?.type === ActionType.Develop
}

export class HydratedDevelop extends HydratableAction<typeof Develop> implements Develop {
    declare type: ActionType.Develop
    declare playerId: string
    declare metadata?: DevelopMetadata
    declare cityId: string
    declare payeeIds?: CompanyId[]

    constructor(data: Develop) {
        super(data, DevelopValidator)
    }

    apply(state: HydratedHcgGameState, _context?: MachineContext) {
        assert(state.developableCities().includes(this.cityId), 'That city cannot be developed')
        const paidCompanyIds = this.payees(state)
        state.company(CompanyId.Balcones).treasury -= paidCompanyIds.length
        for (const companyId of paidCompanyIds) {
            state.company(companyId).treasury += 1
        }
        state.developments[this.cityId] = state.markersIn(this.cityId) + 1
        state.turnDevelopments.push(this.cityId)
        this.metadata = { paidCompanyIds }
    }

    private payees(state: HydratedHcgGameState): CompanyId[] {
        const present = state.grocersInCity(this.cityId)
        if (!state.mustChooseBuilderPayees(this.cityId)) {
            assert(this.payeeIds === undefined, 'Balcones Builders pays every grocer it can')
            return state.builderPaymentsDue(this.cityId) > 0 ? present : []
        }
        const chosen = this.payeeIds ?? []
        assert(
            chosen.length === state.builderPaymentsDue(this.cityId) &&
                new Set(chosen).size === chosen.length &&
                chosen.every((companyId) => present.includes(companyId)),
            'Choose which grocers Balcones Builders pays'
        )
        return chosen
    }

    static canDevelop(state: HydratedHcgGameState): boolean {
        return state.turnDevelopments.length < 2 && state.developableCities().length > 0
    }
}
