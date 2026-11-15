import { describe, expect, it } from 'vitest'
import { DestinationStationSource } from '@tabletop/18xx'
import { PortLocationIds, type RevenueToken } from '@tabletop/1870'
import { destinationMarkers, portLocationIds } from './mapState.js'

const portsShown = (revenueTokens: RevenueToken[], closed = false) =>
    portLocationIds({ revenueTokens, companies: [{ id: 'GSC', kind: 'private', closed }] })
const token = (kind: RevenueToken['kind'], locationId: string): RevenueToken => ({
    kind,
    companyId: 'IC',
    locationId,
    placedInRound: [1, 1]
})

describe('the port anchors', () => {
    it('show every port city until a port is placed', () => {
        expect(portsShown([])).toEqual(PortLocationIds)
        expect(portsShown([token('cattle', 'B9')])).toEqual(PortLocationIds)
    })
    it('show only the placed port’s city', () => {
        expect(portsShown([token('open-port', 'N17')])).toEqual(['N17'])
        expect(portsShown([token('closed-port', 'M14')], true)).toEqual(['M14'])
    })
    it('go once the Gulf Shipping Company has closed with no port placed', () => {
        expect(portsShown([], true)).toEqual([])
    })
})

describe('the destination markers', () => {
    const atDenver = (facts: Parameters<typeof destinationMarkers>[0]) =>
        destinationMarkers(facts)
            .filter((marker) => marker.locationId === 'A2')
            .map((marker) => marker.kind)
    const none = { destinationRunsMade: [], destinationStations: [] }
    const placed = {
        destinationStations: ['FW'],
        stationAccess: [
            {
                companyId: 'FW',
                locationId: 'A2',
                nodeId: 'offboard',
                sourceId: DestinationStationSource
            }
        ]
    }

    it('show the mark until the company reaches its destination', () => {
        expect(atDenver(none)).toEqual(['destination:FW'])
    })
    it('put the station in the mark’s place during the connection run', () => {
        expect(atDenver({ ...placed, destinationRunsMade: [] })).toEqual(['station:FW'])
    })
    it('keep the station there after the run', () => {
        expect(atDenver({ ...placed, destinationRunsMade: ['FW'] })).toEqual(['station:FW'])
    })
    it('name the station in a city space under Station Marker Wars', () => {
        expect(atDenver({ destinationRunsMade: [], destinationStations: ['FW'] })).toEqual([
            'station-space:FW'
        ])
    })
    it('show nothing once a company that kept its station has run', () => {
        expect(atDenver({ destinationRunsMade: ['FW'], destinationStations: [] })).toEqual([])
    })
})
