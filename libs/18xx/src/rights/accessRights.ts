import * as Type from 'typebox'
import { cashOwnedBy, type FinancialState } from '../finance/finance.js'
import { actsFor } from '../finance/receivership.js'
import type { MapStateData } from '../map/mapState.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import { isOperatingStep } from '../operating/operatingSteps.js'

const Id = Type.String({ minLength: 1 })
/** A company's purchased right to reach a place, such as a ferry marker to London. */
export const AccessRight = Type.Object(
    { rightId: Id, companyId: Id },
    { additionalProperties: false }
)
export type AccessRight = Type.Static<typeof AccessRight>
/** Optional so that titles without rights leave it out; a title with rights starts it empty. */
export const AccessRightFields = { accessRights: Type.Optional(Type.Array(AccessRight)) }
export type AccessRightState = { accessRights?: AccessRight[] }
export type AccessRightPurchaseState = OperatingState &
    MapStateData &
    AccessRightState & { machineState: string }

/** A kind of right, with how many the supply holds. Each company holds at most one of a kind. */
export type AccessRightDefinition = { id: string; name: string; supply: number }

export interface AccessRightRules {
    rights: readonly AccessRightDefinition[]
    /**
     * What the operating company pays for a right now, or why it may not buy one, beyond the
     * family's own limits: the company already holding one, or an empty supply.
     */
    purchaseTerms(
        state: AccessRightPurchaseState,
        companyId: string,
        rightId: string
    ): { price: number } | { reason: string }
}

export function holdsAccessRight(
    state: AccessRightState,
    companyId: string,
    rightId: string
): boolean {
    return (state.accessRights ?? []).some(
        (right) => right.companyId === companyId && right.rightId === rightId
    )
}

export function accessRightsLeft(
    state: AccessRightState,
    rules: AccessRightRules,
    rightId: string
): number {
    const definition = rules.rights.find((right) => right.id === rightId)
    if (!definition) return 0
    return (
        definition.supply -
        (state.accessRights ?? []).filter((right) => right.rightId === rightId).length
    )
}

/** The price the operating company's president may pay for a right now, or why not. */
export function accessRightPurchase(
    state: AccessRightPurchaseState & FinancialState,
    rules: AccessRightRules,
    playerId: string,
    companyId: string,
    rightId: string
): { price: number } | { reason: string } {
    if (
        !isOperatingStep(state.machineState) ||
        nextOperatingCompany(state) !== companyId ||
        !actsFor(state, playerId, companyId)
    )
        return { reason: 'Only the operating company buys rights during its turn.' }
    if (holdsAccessRight(state, companyId, rightId))
        return { reason: 'The company already holds this right.' }
    if (accessRightsLeft(state, rules, rightId) <= 0) return { reason: 'None remain.' }
    const terms = rules.purchaseTerms(state, companyId, rightId)
    if ('reason' in terms) return terms
    const cash = cashOwnedBy(state, { kind: 'company', companyId })
    if (cash === undefined || (cash !== 'unlimited' && cash < terms.price))
        return { reason: 'The company cannot afford it.' }
    return terms
}

/** The rights the operating company's president may buy now. */
export function purchasableAccessRights(
    state: AccessRightPurchaseState & FinancialState,
    rules: AccessRightRules,
    playerId: string
): { rightId: string; companyId: string; price: number }[] {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return []
    return rules.rights.flatMap((right) => {
        const purchase = accessRightPurchase(state, rules, playerId, companyId, right.id)
        return 'price' in purchase ? [{ rightId: right.id, companyId, price: purchase.price }] : []
    })
}
