import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import type { ValuationRules } from '../ending/finalWealth.js'
import { PlayerNetWorth, playerNetWorth, roundEnd, type RoundEnd } from '../ending/roundEnd.js'
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
        playerNetWorth: PlayerNetWorth,
        companyIds: Type.Array(Type.String())
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
        playerNetWorth: playerNetWorth(state, rules),
        companyIds: state.companies
            .filter((company) => set.companyOrder.includes(company.id))
            .map((company) => company.id)
    }
}

/** The operating round's end, recorded by an Action that ends its last company's turn. */
export function operatingRoundEnd(
    state: OperatingState,
    rules: ValuationRules
): RoundEnd | undefined {
    return state.operatingSet && !nextOperatingCompany(state)
        ? roundEnd(state, rules, 'operating')
        : undefined
}
