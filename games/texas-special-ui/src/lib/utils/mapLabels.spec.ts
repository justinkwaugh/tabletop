import { describe, expect, it } from 'vitest'
import { MapId, SettlementKind, sarMap } from '@tabletop/texas-special'
import { boxesOverlap, mapLabels, nameBox, segmentCrossesBox } from './mapLabels.js'

describe.each(Object.values(MapId))('the %s map', (mapId) => {
    const map = sarMap(mapId)
    const labels = mapLabels(mapId)
    const names = map.settlements
        .filter((place) => labels.settlementLabels[place.id])
        .map((place) => ({
            id: place.id,
            box: nameBox(place.name, labels.settlementLabels[place.id])
        }))
    const linkBox = (box: { x: number; y: number }) => ({
        x: box.x - 10,
        y: box.y - 10,
        width: 20,
        height: 20
    })

    it('names every settlement the board names, but the metro areas, which carry plates', () => {
        expect(names.map((name) => name.id).toSorted()).toEqual(
            map.settlements
                .filter((place) => labels.hasNameLabel(place))
                .map((place) => place.id)
                .toSorted()
        )
    })

    it('keeps names clear of every settlement icon', () => {
        const clashes = names.flatMap((name) =>
            map.settlements
                .filter((place) => boxesOverlap(name.box, labels.settlementIconBox(place)))
                .map((place) => `${name.id} on ${place.id}`)
        )
        expect(clashes).toEqual([])
    })

    it('keeps names clear of the link building boxes', () => {
        const clashes = names.flatMap((name) =>
            map.links
                .filter((trackLink) => boxesOverlap(name.box, linkBox(trackLink.box)))
                .map((trackLink) => `${name.id} on ${trackLink.id}`)
        )
        expect(clashes).toEqual([])
    })

    it('keeps names clear of the track lines', () => {
        const clashes = names
            .filter((name) =>
                labels.trackSegments.some((segment) => segmentCrossesBox(segment, name.box))
            )
            .map((name) => name.id)
        expect(clashes).toEqual([])
    })

    it('keeps names clear of each other', () => {
        const clashes = names.flatMap((name, index) =>
            names
                .slice(index + 1)
                .filter((other) => boxesOverlap(name.box, other.box))
                .map((other) => `${name.id} on ${other.id}`)
        )
        expect(clashes).toEqual([])
    })

    it('keeps metro name plates clear of the link building boxes and other icons', () => {
        const metros = map.settlements.filter((place) => place.kind === SettlementKind.MetroArea)
        const clashes = metros.flatMap((metro) => {
            const plate = labels.metroCaption(metro)
            if (!plate) {
                return []
            }
            return [
                ...map.links
                    .filter((trackLink) => boxesOverlap(plate, linkBox(trackLink.box)))
                    .map((trackLink) => `${metro.id} on ${trackLink.id}`),
                ...map.settlements
                    .filter(
                        (place) =>
                            place.id !== metro.id &&
                            boxesOverlap(plate, labels.settlementIconBox(place))
                    )
                    .map((place) => `${metro.id} on ${place.id}`)
            ]
        })
        expect(clashes).toEqual([])
    })
})

describe('the Frontier Railroads map', () => {
    const map = sarMap(MapId.Frontier)
    const labels = mapLabels(MapId.Frontier)

    it('names no settlement on the board but its metro areas, on their plates', () => {
        expect(Object.keys(labels.settlementLabels)).toEqual([])
        expect(
            map.settlements.filter((place) => labels.metroCaption(place)).map((place) => place.name)
        ).toEqual(['The Junction', 'The Center'])
    })
})

describe('the Keystone Railroads map', () => {
    const map = sarMap(MapId.Keystone)
    const labels = mapLabels(MapId.Keystone)

    it('names only its five metro areas, each on its plate', () => {
        expect(Object.keys(labels.settlementLabels)).toEqual([])
        expect(
            map.settlements
                .filter((place) => labels.metroCaption(place))
                .map((place) => place.name)
                .toSorted()
        ).toEqual(['The Bend', 'The Crossroads', 'The Keystone', 'The Landing', 'The Works'])
    })
})
