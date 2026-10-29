import { describe, expect, it } from 'vitest'
import {
    bonusRoute,
    payingRouteStops,
    routeStopBonuses,
    type RouteRevenuePolicy
} from './routeScoring.js'

const stop = (locationId: string, amount: number) => ({
    locationId,
    nodeId: 'city',
    amount,
    bonus: 0,
    companyStation: locationId === 'home'
})

// A 2/4 train runs home, a cheap town, a hub worth a bonus with the coast, and the coast.
const visits = [stop('home', 30), stop('hub', 10), stop('mid', 40), stop('coast', 20)]
const bonus = { from: { hub: 50 }, to: { coast: 0 } }
const policy: RouteRevenuePolicy = {
    payingStopLimit: 3,
    requirePayingStation: true,
    connectionBonuses: [bonus]
}

describe('route bonuses for N/M trains', () => {
    it('count only paid stops by default', () => {
        const paid = [visits[0], visits[2], visits[3]]
        const route = bonusRoute(visits, paid, policy)
        expect(routeStopBonuses(route.stops, policy, route.shape)).toEqual([])
    })

    it('count every stop between the first and last paid along the route', () => {
        const along = { ...policy, bonusesAlongRoute: true as const }
        const paid = [visits[0], visits[2], visits[3]]
        const route = bonusRoute(visits, paid, along)
        expect(route.stops.map((entry) => entry.locationId)).toEqual([
            'home',
            'hub',
            'mid',
            'coast'
        ])
        expect(routeStopBonuses(route.stops, along, route.shape)).toEqual([
            { locationId: 'hub', amount: 50 }
        ])
        // So the train pays home, mid and the coast and still earns the hub's bonus.
        expect(payingRouteStops(visits, along).map((entry) => entry.locationId)).toEqual([
            'home',
            'mid',
            'coast'
        ])
    })

    it('drop stops skipped off an end, which no longer end the route', () => {
        const along = {
            payingStopLimit: 2,
            connectionBonuses: [{ ...bonus, destinationAtEnd: true as const }],
            bonusesAlongRoute: true as const
        }
        const paid = [visits[1], visits[2]]
        const route = bonusRoute(visits, paid, along, { ends: [visits[0], visits[3]] })
        expect(route.stops.map((entry) => entry.locationId)).toEqual(['hub', 'mid'])
        expect(routeStopBonuses(route.stops, along, route.shape)).toEqual([])
    })
})
