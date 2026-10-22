import { describe, expect, it } from 'vitest'
import type { ProjectedUnit } from '@tabletop/napoleons-triumph'
import { corpsClusters } from './corpsClusters.js'

function unit(id: string, commanderId?: string): ProjectedUnit {
    return { id, playerId: 'p1', commanderId } as ProjectedUnit
}

const asGiven = (units: readonly ProjectedUnit[]) => [...units]

describe('the units of a battle panel by corps', () => {
    it('puts each corps together, in commander order, and the detached units last', () => {
        const clusters = corpsClusters(
            [
                unit('u1'),
                unit('u2', 'prebyshevsky'),
                unit('u3', 'langeron'),
                unit('u4', 'prebyshevsky')
            ],
            asGiven
        )
        expect(
            clusters.map((cluster) => [cluster.commanderId, cluster.units.map((u) => u.id)])
        ).toEqual([
            ['langeron', ['u3']],
            ['prebyshevsky', ['u2', 'u4']],
            [undefined, ['u1']]
        ])
    })

    it('orders the units of each corps as the viewer reads them', () => {
        const reversed = (units: readonly ProjectedUnit[]) => units.toReversed()
        const clusters = corpsClusters([unit('u1', 'langeron'), unit('u2', 'langeron')], reversed)
        expect(clusters[0].units.map((u) => u.id)).toEqual(['u2', 'u1'])
    })
})
