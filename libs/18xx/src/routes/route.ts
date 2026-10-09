import * as Type from 'typebox'
import type { FinancialState } from '../finance/finance.js'
import type { MapStateData } from '../map/mapState.js'
import type { TrainState } from '../trains/train.js'
import { assert } from '@tabletop/common'
const Id = Type.String({ minLength: 1 })
export const RevenueCenter = Type.Object(
    { locationId: Id, nodeId: Id },
    { additionalProperties: false }
)
export type RevenueCenter = Type.Static<typeof RevenueCenter>
export const RoutePath = Type.Object(
    { locationId: Id, pathId: Id },
    { additionalProperties: false }
)
export type RoutePath = Type.Static<typeof RoutePath>
export const TrainRoute = Type.Object(
    { trainId: Id, start: RevenueCenter, paths: Type.Array(RoutePath, { minItems: 1 }) },
    { additionalProperties: false }
)
export type TrainRoute = Type.Static<typeof TrainRoute>
export const RoutePayment = Type.Object(
    { ...RevenueCenter.properties, amount: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type RoutePayment = Type.Static<typeof RoutePayment>
export const RouteBonus = Type.Object(
    {
        locationId: Id,
        amount: Type.Integer({ minimum: 1 }),
        /** What earned the bonus, such as a private company, where the title names it. */
        label: Type.Optional(Type.String({ minLength: 1 }))
    },
    { additionalProperties: false }
)
export type RouteBonus = Type.Static<typeof RouteBonus>
export const RouteResult = Type.Object(
    {
        ...TrainRoute.properties,
        definitionId: Type.String(),
        visits: Type.Array(RevenueCenter),
        payments: Type.Array(RoutePayment),
        bonuses: Type.Optional(Type.Array(RouteBonus, { minItems: 1 })),
        distance: Type.Integer({ minimum: 0 }),
        revenue: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type RouteResult = Type.Static<typeof RouteResult>
export const OperatingResult = Type.Object(
    { companyId: Id, routes: Type.Array(RouteResult), revenue: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type OperatingResult = Type.Static<typeof OperatingResult>
export const RouteStep = Type.Object(
    { companyId: Id, result: Type.Optional(OperatingResult) },
    { additionalProperties: false }
)
export type RouteStep = Type.Static<typeof RouteStep>
export const RouteFields = { routeStep: Type.Optional(RouteStep) }
export type RouteState = Type.Static<Type.TObject<typeof RouteFields>>
export type TrainRunningState = FinancialState &
    MapStateData &
    TrainState &
    RouteState & { phaseId: string }

export function validateRouteStep(state: {
    machineState: string
    routeStep?: RouteStep
    operatingSet?: { companyOrder: readonly string[] }
}): void {
    if (state.machineState !== 'RunningTrains' && state.machineState !== 'DistributingEarnings')
        return
    assert(
        state.routeStep && state.operatingSet?.companyOrder.includes(state.routeStep.companyId),
        'Routes require an operating company'
    )
    assert(
        (state.machineState === 'DistributingEarnings') === Boolean(state.routeStep.result),
        'Route result must match operation progress'
    )
}
