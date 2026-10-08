import * as Type from 'typebox'
import { Visibility } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { GoodCounts } from '../components/goods.js'
import { MAX_OFFICES_PER_CITY } from '../components/cities.js'

export const concealedValuePolicy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.stateEquals('machineState', MachineState.EndOfGame)
)

export type HiddenRouteMarker = Type.Static<typeof HiddenRouteMarker>
export const HiddenRouteMarker = Type.Object({
    playerId: Type.String(),
    value: Visibility.protect(Type.Integer({ minimum: 0 }), { policy: concealedValuePolicy })
})

export type RouteSlot = Type.Static<typeof RouteSlot>
export const RouteSlot = Type.Object({
    value: Type.Optional(Type.Integer({ minimum: 0 })),
    hidden: Type.Optional(HiddenRouteMarker)
})

export type Office = Type.Static<typeof Office>
export const Office = Type.Object({
    playerId: Type.String(),
    goods: Type.Integer({ minimum: 0 })
})

export type CityState = Type.Static<typeof CityState>
export const CityState = Type.Object({
    number: Type.Integer({ minimum: 0 }),
    goods: GoodCounts,
    offices: Type.Array(Office),
    routes: Type.Array(RouteSlot),
    raiders: Type.Array(Type.String())
})

export type ProjectedRouteSlot = Type.Static<typeof ProjectedRouteSlot>
export const ProjectedRouteSlot = Visibility.createProjectionSchema(RouteSlot)

export type ProjectedCityState = Type.Static<typeof ProjectedCityState>
export const ProjectedCityState = Visibility.createProjectionSchema(CityState)

export function knownDestination(slot: ProjectedRouteSlot, playerId: string): number | undefined {
    if (slot.value !== undefined) {
        return slot.value
    }
    return slot.hidden?.playerId === playerId ? slot.hidden.value : undefined
}

export function slotDestination(slot: ProjectedRouteSlot): number {
    const destination = slot.value ?? slot.hidden?.value
    if (destination === undefined) {
        throw Error('The route marker value is unavailable in this representation')
    }
    return destination
}

export function hasOfficeRoom(city: ProjectedCityState): boolean {
    return city.offices.length < MAX_OFFICES_PER_CITY
}

export function officeGoodsTotal(city: ProjectedCityState): number {
    return city.offices.reduce((sum, office) => sum + office.goods, 0)
}

export function isRaided(city: ProjectedCityState): boolean {
    return city.raiders.length > 0
}
