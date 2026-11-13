import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { MapView1849 } from './mapView.js'

const scenario = (name: string) =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

it('locks Messina from the earthquake until the next stock round has ended (§12)', () => {
    const shaken = scenario('after-earthquake')
    expect(MapView1849.stateMarkers?.(shaken)).toEqual([
        { locationId: 'B14', kind: 'messina-lock' }
    ])
    const after = {
        ...shaken,
        stockRound: { ...shaken.stockRound, number: shaken.messinaLockedUntil, completed: true }
    }
    expect(MapView1849.stateMarkers?.(after)).toEqual([])
    expect(MapView1849.stateMarkers?.(scenario('first-stock-round'))).toEqual([])
})

it('names every marker it implies (§12)', () => {
    for (const marker of MapView1849.stateMarkers?.(scenario('after-earthquake')) ?? [])
        expect(MapView1849.locationMarkerNames?.[marker.kind]).toBeTruthy()
})
