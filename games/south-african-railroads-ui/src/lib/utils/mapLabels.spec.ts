import { describe, expect, it } from 'vitest'
import { MapId, SettlementKind, sarMap } from '@tabletop/south-african-railroads'
import { boardLayout } from './boardLayout.js'
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

    it('keeps the printed furniture on the board and clear of icons, link boxes and track', () => {
        const layout = boardLayout(mapId)
        const clashes = layout.furniture.flatMap((box) => [
            ...map.settlements
                .filter((place) => boxesOverlap(box, labels.settlementIconBox(place)))
                .map((place) => `furniture on ${place.id}`),
            ...map.links
                .filter((trackLink) => boxesOverlap(box, linkBox(trackLink.box)))
                .map((trackLink) => `furniture on ${trackLink.id}`),
            ...(labels.trackSegments.some((segment) => segmentCrossesBox(segment, box))
                ? ['furniture on track']
                : []),
            ...(box.x < 0 ||
            box.y < layout.top ||
            box.x + box.width > layout.width ||
            box.y + box.height > layout.top + layout.height
                ? ['furniture off the board']
                : [])
        ])
        expect(clashes).toEqual([])
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

describe('the Pennsylvania Railroad map', () => {
    const map = sarMap(MapId.Pennsylvania)
    const labels = mapLabels(MapId.Pennsylvania)

    it('names its five metro areas on their plates', () => {
        expect(
            map.settlements
                .filter((place) => labels.metroCaption(place))
                .map((place) => place.name)
                .toSorted()
        ).toEqual(['Chicago', 'Cincinnati', 'Detroit', 'Pittsburgh', 'St Louis'])
    })
})
