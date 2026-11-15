import { describe, expect, it } from 'vitest'
import { runLocationIds, trainRouteOverlays } from './routePresentation.js'

describe('runLocationIds', () => {
    it('names a route’s start and each hex of its track once', () => {
        expect(
            runLocationIds([
                {
                    start: { locationId: 'A1', nodeId: 'city' },
                    paths: [
                        { locationId: 'A1', pathId: 'a' },
                        { locationId: 'B2', pathId: 'b' }
                    ]
                }
            ])
        ).toEqual(['A1', 'B2'])
    })

    it('names the station of a run on no track', () => {
        expect(
            runLocationIds([{ start: { locationId: 'H1', nodeId: 'city' }, paths: [] }])
        ).toEqual(['H1'])
    })
})

describe('trainRouteOverlays', () => {
    const paths = [{ locationId: 'G22', pathId: 'path-0' }]

    it('names each bonus arrow its bonuses record once', () => {
        const [overlay] = trainRouteOverlays([
            {
                trainId: 'train-1',
                paths,
                bonuses: [
                    {
                        locationId: 'B17',
                        amount: 100,
                        arrowIds: ['boston-and-albany-troy', 'albany-troy-to-boston']
                    },
                    { locationId: 'G22', amount: 50, arrowIds: ['albany-troy-to-boston'] },
                    { locationId: 'E20', amount: 20, sourceIds: ['ferry'] }
                ]
            }
        ])
        expect(overlay.bonusArrowIds).toEqual(['boston-and-albany-troy', 'albany-troy-to-boston'])
    })

    it('leaves a route without arrow bonuses unmarked', () => {
        const [overlay] = trainRouteOverlays([{ trainId: 'train-1', paths }])
        expect(overlay).not.toHaveProperty('bonusArrowIds')
    })
})
