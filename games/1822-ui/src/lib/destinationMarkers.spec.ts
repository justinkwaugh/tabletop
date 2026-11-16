import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LnwrId, Majors1822, destinationStationId } from '@tabletop/1822'
import {
    destinationMarkerKind,
    destinationMarkers1822,
    destinationStationMarkerKind
} from './destinationMarkers.js'

const scenario = (name: string) =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

describe('destination markers (§5.11)', () => {
    it('mark every major company’s destination but the LNWR’s, whose Manchester station is a home', () => {
        const markers = destinationMarkers1822(scenario('first-stock-round'))
        expect(markers).toEqual(
            Majors1822.filter((major) => major.id !== LnwrId).map((major) => ({
                locationId: major.destination.locationId,
                kind: destinationMarkerKind(major.id)
            }))
        )
    })

    it('outline a placed destination token in place of the mark, and the LNWR’s once connected', () => {
        const state = scenario('first-stock-round')
        const [major] = Majors1822.filter((entry) => entry.id !== LnwrId)
        const lnwr = Majors1822.find((entry) => entry.id === LnwrId)
        const placedAt = (companyId: string, locationId = '') => ({
            id: destinationStationId(companyId),
            companyId,
            status: 'placed',
            position: { locationId, nodeId: 'city', slot: 0 }
        })
        const ids = [destinationStationId(major.id), destinationStationId(LnwrId)]
        const markers = destinationMarkers1822({
            ...state,
            lnwrConnected: true,
            stations: [
                ...state.stations.filter((station: { id: string }) => !ids.includes(station.id)),
                placedAt(major.id, major.destination.locationId),
                placedAt(LnwrId, lnwr?.destination.locationId)
            ]
        })
        expect(markers).toContainEqual({
            locationId: major.destination.locationId,
            kind: destinationStationMarkerKind(major.id)
        })
        expect(markers).not.toContainEqual({
            locationId: major.destination.locationId,
            kind: destinationMarkerKind(major.id)
        })
        expect(markers).toContainEqual({
            locationId: lnwr?.destination.locationId,
            kind: destinationStationMarkerKind(LnwrId)
        })
    })
})
