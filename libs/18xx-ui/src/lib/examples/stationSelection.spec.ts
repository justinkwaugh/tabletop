import { expect, it } from 'vitest'
import { chooseStation, chooseStationPosition, backFromStation } from './stationSelection.js'
it('backs out of the chosen position before the station and clears position on reselection', () => {
    const station = chooseStation('A:1')
    const position = chooseStationPosition(station, {
        companyId: 'A',
        stationId: 'A:1',
        position: { locationId: 'A1', nodeId: 'city', slot: 0 }
    })
    expect(backFromStation(position)).toEqual(station)
    expect(backFromStation(station)).toEqual({})
    expect(chooseStation('A:2').placement).toBeUndefined()
})
