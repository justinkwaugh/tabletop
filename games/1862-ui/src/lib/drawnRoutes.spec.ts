import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
    Map1862,
    Market1862,
    RouteRules1862,
    StateDefinition1862,
    TileSet1862,
    TrainDepot1862
} from '@tabletop/1862'
import { RouteEditor } from '@tabletop/18xx-ui'

// Waveney Valley at its run in the Phase D scenario: three 2/3L trains and a 2/3E.
function waveneyValley() {
    const { state } = JSON.parse(
        readFileSync(new URL('../scenarios/phase-d-trains.json', import.meta.url), 'utf8')
    )
    const hydrated = StateDefinition1862.hydrate(state, {
        map: Map1862,
        tileSet: TileSet1862,
        depot: TrainDepot1862,
        market: Market1862
    })
    hydrated.routeStep = { companyId: 'WVR' }
    return new RouteEditor(hydrated, RouteRules1862)
}

const stop = (locationId: string) => ({ kind: 'hex' as const, locationId })

// Waveney Valley's home is Beccles, G8 (§7.2).
function drawBoth(editor: RouteEditor, from: string, to: string) {
    const [local, , , express] = editor.trains.map((train) => train.id)
    for (const trainId of [local, express]) {
        editor.selectTrain(trainId, [])
        editor.tap(stop(from))
        editor.tap(stop(to))
    }
}

describe('drawing 1862 routes', () => {
    it('lets two trains share track (§7.4)', () => {
        const editor = waveneyValley()
        drawBoth(editor, 'G8', 'E12')
        const [first, second] = editor.routes
        expect(first.paths.length).toBeGreaterThan(0)
        expect(first.paths).toEqual(second.paths)
        expect(editor.evaluated?.reason).toBeUndefined()
        expect(editor.evaluated?.result?.routes).toHaveLength(2)
    })

    it('refuses a drawn run that leaves out the home station (§7.4)', () => {
        const editor = waveneyValley()
        drawBoth(editor, 'E12', 'E8')
        expect(editor.evaluated?.reason).toMatch(/home/)
    })
})
