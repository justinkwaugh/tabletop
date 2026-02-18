import { describe, expect, it } from 'vitest'
import { findNodeToSitePassengerDeliveries } from './passengerDeliveryAnimator.js'

describe('findNodeToSitePassengerDeliveries', () => {
    it('returns every passenger that transitioned from a node to a building site', () => {
        const fromPassengers = [
            { id: 'p1', nodeId: 'N01' },
            { id: 'p2', nodeId: 'N07' },
            { id: 'p3', nodeId: 'N08' },
            { id: 'p4', nodeId: 'N03', siteId: 'B03' }
        ]

        const toPassengers = [
            { id: 'p1', nodeId: 'N01', siteId: 'B01' },
            { id: 'p2', nodeId: 'N07', siteId: 'B09' },
            { id: 'p3', nodeId: 'N08' },
            { id: 'p4', nodeId: 'N03', siteId: 'B03' }
        ]

        expect(findNodeToSitePassengerDeliveries(fromPassengers, toPassengers)).toEqual([
            { id: 'p1', sourceNodeId: 'N01', destinationSiteId: 'B01' },
            { id: 'p2', sourceNodeId: 'N07', destinationSiteId: 'B09' }
        ])
    })

    it('ignores passengers that do not represent a valid node-to-site move', () => {
        const fromPassengers = [
            { id: 'p1', nodeId: 'BAD' },
            { id: 'p2', nodeId: 'N02', siteId: 'B02' },
            { id: 'p3', nodeId: 'N03' },
            { id: 'p4', nodeId: 'N04' }
        ]

        const toPassengers = [
            { id: 'p1', nodeId: 'BAD', siteId: 'B01' },
            { id: 'p2', nodeId: 'N02', siteId: 'B02' },
            { id: 'p3', nodeId: 'N03', siteId: 'NOT_A_SITE' },
            { id: 'p4', nodeId: 'N04' }
        ]

        expect(findNodeToSitePassengerDeliveries(fromPassengers, toPassengers)).toEqual([])
    })
})
