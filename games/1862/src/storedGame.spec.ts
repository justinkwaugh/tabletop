import { expect } from 'vitest'
import { TileSet1862 } from './tiles.js'
import { storedGameTests } from '../../../libs/18xx/test/storedGame.js'
import { Definition } from './definition/gameDefinition.js'

// The harness scenario "phase-d-trains" as the logic stored it before presidents were derived from
// their certificates (2026-11-20), its actions dropped for size.
storedGameTests(
    Definition,
    new URL('../test/fixtures/stored-game.json', import.meta.url),
    (stored) => {
        const stops = Object.values(stored.tileInventory.placements).flatMap(
            (placement) => placement.trackStops ?? []
        )
        expect(stops.length).toBeGreaterThan(0)
        for (const stop of stops) expect(stop.revenue).toBe(TileSet1862.trackStopRevenue)
    }
)
