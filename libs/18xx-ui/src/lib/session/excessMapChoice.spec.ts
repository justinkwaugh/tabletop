import { describe, expect, it } from 'vitest'
import type { PlacedStation } from '@tabletop/18xx'
import { excessMapChoice } from './sizedCompanyModules.svelte.js'

const station = (id: string, locationId: string, nodeId = 'city'): PlacedStation => ({
    id,
    companyId: 'BO',
    status: 'placed',
    position: { locationId, nodeId, slot: 0 }
})

function choosing(stations: PlacedStation[], markers = [{ locationId: 'B2', kind: 'freight' }]) {
    const removed: string[] = []
    const choice = excessMapChoice(stations, markers, {
        station: (stationId) => removed.push(stationId),
        marker: (marker) => removed.push(`${marker.kind}@${marker.locationId}`)
    })
    return { choice, removed }
}

describe('choosing a station to give up on the map', () => {
    it('offers each hex holding a station or a station marker once', () => {
        const { choice } = choosing([station('BO:1', 'E15'), station('BO:2', 'D28', 'city-0')])
        expect(choice?.locationIds).toEqual(['E15', 'D28', 'B2'])
    })

    it('removes the hex’s station, or its marker, with one tap', () => {
        const { choice, removed } = choosing([station('BO:1', 'E15')])
        choice?.choose('E15')
        choice?.choose('B2')
        expect(removed).toEqual(['BO:1', 'freight@B2'])
    })

    it('takes the city tapped where the company holds a station in each of a hex’s two', () => {
        const { choice, removed } = choosing([
            station('BO:1', 'D28', 'city-0'),
            station('BO:2', 'D28', 'city-1')
        ])
        choice?.choose('D28')
        choice?.choose('D28', 'city-1')
        expect(removed).toEqual(['BO:2'])
    })

    it('offers nothing when nothing may be given up', () => {
        expect(choosing([], []).choice).toBeUndefined()
    })
})
