import { ConstructionReachability, RailwayMapState } from '@tabletop/18xx'
import { expect, it } from 'vitest'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'

it('does not reach Hunter River by doubling back through Emerald Jct', () => {
    // From Charlottetown, track runs through K17 and the switch at J16 into Emerald Jct. Hunter
    // River lies on the switch's other branch, which only a route leaving Emerald Jct the way it
    // came could take.
    const mapState = new RailwayMapState(
        TheOldPrinceMap,
        TheOldPrinceTileSet,
        TheOldPrinceTileSet.createInventory([
            { locationId: 'L16', definitionId: 'the-old-prince:PEI5', rotation: 0 },
            { locationId: 'K17', definitionId: '18xx:8', rotation: 2 },
            { locationId: 'J16', definitionId: '18xx:25', rotation: 1 }
        ])
    )
    const reachability = new ConstructionReachability(
        mapState,
        {
            stations: [
                {
                    id: 'So:station:2',
                    companyId: 'So',
                    status: 'placed',
                    position: { locationId: 'L16', nodeId: 'city', slot: 1 }
                }
            ],
            stationReservations: []
        },
        'So'
    )
    expect(reachability.canReach('I17')).toBe(true)
    expect(reachability.canReach('J14')).toBe(false)
})
