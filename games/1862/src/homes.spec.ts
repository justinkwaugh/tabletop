import { addCompanyStations } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { available } from '../test/kit.js'
import { floatAt, hold, layTile, operatingTurn, player, twoCompanies } from '../test/positions.js'
import { company1862 } from './companies.js'
import { homeCity, homeHasRoom, homeUpgradeAddsRoom, isPlaceHome } from './homes.js'

describe('1862 displaced home stations (§7.2)', () => {
    it('displaces the station in the full home city’s highest space, as spaces fill in order', () => {
        const { game, state, a, b } = twoCompanies(
            { price: 100, train: true },
            { price: 90, train: true },
            'BuyingTrains'
        )
        const c = available(game)[2]
        hold(state, a, [{ owner: player('p1'), shares: 6 }])
        hold(state, b, [{ owner: player('p2'), shares: 6 }])
        hold(state, c, [{ owner: player('p3'), shares: 6 }])
        floatAt(state, c, { price: 82, train: false })
        state.stations.push({ id: `${c}:home`, companyId: c, status: 'available' })
        // A green two-space city in phase A, which no tile yet available can enlarge.
        const home = company1862(c).home
        layTile(state, home, '18xx:14')
        const city = homeCity(state, c)
        addCompanyStations(state, a, 1)
        addCompanyStations(state, b, 1)
        const [high, low] = [a, b].map((companyId) => {
            const station = state.stations.findLast((entry) => entry.companyId === companyId)
            assertExists(station, 'The company has a station to place')
            return station.id
        })
        // Listed before the other, so the highest space is not simply the last station placed.
        state.stations = state.stations.map((station) =>
            station.id === high || station.id === low
                ? {
                      id: station.id,
                      companyId: station.companyId,
                      status: 'placed',
                      position: {
                          locationId: home,
                          nodeId: city.nodeId,
                          slot: station.id === high ? 1 : 0
                      }
                  }
                : station
        )
        operatingTurn(state, [a, c], a, 'BuyingTrains')
        game.state = state
        expect(homeHasRoom(game.state, c)).toBe(false)
        expect(homeUpgradeAddsRoom(game.state, c)).toBe(false)

        game.act('FinishOperatingTurn', { companyId: a }, 'p1')

        const placed = game.actions.filter(isPlaceHome)
        expect(placed.map((action) => [action.companyId, action.metadata])).toEqual([
            [
                c,
                {
                    position: { locationId: home, nodeId: city.nodeId, slot: 1 },
                    displacedStationId: high
                }
            ]
        ])
        const station = (id: string) => game.state.stations.find((entry) => entry.id === id)
        expect(station(high)).toEqual({ id: high, companyId: a, status: 'available' })
        expect(station(low)).toMatchObject({ status: 'placed', position: { slot: 0 } })
        expect(station(`${c}:home`)).toMatchObject({ status: 'placed', position: { slot: 1 } })
        expect(game.state.trackStep?.companyId).toBe(c)
    })
})
