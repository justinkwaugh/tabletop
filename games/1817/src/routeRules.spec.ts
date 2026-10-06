import { RouteEvaluation } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { assertExists } from '@tabletop/common'
import { expect, it } from 'vitest'
import { EighteenSeventeenRouteRules } from './routeRules.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { EighteenSeventeenTileSet } from './tiles.js'

it('rejects repeated junctions between stops while allowing consecutive segments', () => {
    const { state } = playExample(EighteenSeventeenScenarios, 'construction', 3)
    state.tileInventory = EighteenSeventeenTileSet.createInventory([
        { locationId: 'E8', definitionId: '18xx:545', rotation: 0 },
        { locationId: 'F7', definitionId: '18xx:7', rotation: 2 },
        { locationId: 'E6', definitionId: '18xx:7', rotation: 4 },
        { locationId: 'D7', definitionId: '18xx:57', rotation: 2 }
    ])
    state.phaseId = '5'
    state.routeStep = { companyId: 'BA' }
    state.stations = [
        {
            id: 'home',
            companyId: 'BA',
            status: 'placed',
            position: { locationId: 'D9', nodeId: 'city', slot: 0 }
        }
    ]
    const train = state.trainInventory.trains.find(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === 'BA'
    )
    assertExists(train, 'BA owns a train')
    const route = {
        trainId: train.id,
        start: { locationId: 'D9', nodeId: 'city' },
        paths: [
            ['D9', 'edge-0'],
            ['E8', 'edge-3'],
            ['E8', 'edge-0'],
            ['F7', 'path-0'],
            ['E6', 'path-0'],
            ['E8', 'edge-1'],
            ['E8', 'edge-2'],
            ['D7', 'edge-3']
        ].map(([locationId, pathId]) => ({ locationId, pathId }))
    }
    const evaluation = new RouteEvaluation(state, EighteenSeventeenRouteRules)
    expect(evaluation.evaluate('BA', [route]).reason).toBe(
        'A route cannot revisit a junction between two stops.'
    )
    route.paths.splice(2, 4)
    expect(evaluation.evaluate('BA', [route]).result?.revenue).toBe(70)
})
