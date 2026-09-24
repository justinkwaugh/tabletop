import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { portfolioWealth, type ValuationRules } from '../ending/finalWealth.js'
import { nextOperatingCompany, type OperatingState } from './operatingSet.js'

export const OperatingRoundIdentity = Type.Object(
    {
        number: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type OperatingRoundIdentity = Type.Static<typeof OperatingRoundIdentity>
export const OperatingRoundSnapshot = Type.Object(
    {
        ...OperatingRoundIdentity.properties,
        complete: Type.Boolean(),
        playerNetWorth: Type.Record(Type.String(), Type.Number()),
        companyNames: Type.Record(Type.String(), Type.String())
    },
    { additionalProperties: false }
)
export type OperatingRoundSnapshot = Type.Static<typeof OperatingRoundSnapshot>

export function operatingRoundSnapshot(
    state: OperatingState,
    rules: ValuationRules
): OperatingRoundSnapshot {
    const set = state.operatingSet
    assertExists(set, 'Round snapshot requires an operating set')
    return {
        number: set.number,
        roundNumber: set.roundNumber,
        complete: !nextOperatingCompany(state),
        playerNetWorth: Object.fromEntries(
            state.players.map(({ playerId }) => [
                playerId,
                portfolioWealth(state, { kind: 'player', playerId }, rules).reduce(
                    (sum, item) => sum + item.value,
                    0
                )
            ])
        ),
        companyNames: Object.fromEntries(
            state.companies
                .filter((company) => set.companyOrder.includes(company.id))
                .map((company) => [company.id, company.name])
        )
    }
}
