import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, type ProjectedUnit } from '@tabletop/napoleons-triumph'
import { corpsName, standingGroupName } from './groupNames.js'

const unit = (fields: Partial<ProjectedUnit>): ProjectedUnit => ({
    id: 'F-guard',
    playerId: 'p1',
    ...fields
})

describe('the name of the group a unit stands in', () => {
    it('is its corps, or that it is detached and how it stands', () => {
        const approach = AUSTERLITZ.approachBetween(93, 94)
        expect(corpsName('st-hilaire')).toBe('St. Hilaire’s corps')
        expect(standingGroupName(AUSTERLITZ, unit({ commanderId: 'st-hilaire' }))).toBe(
            'St. Hilaire’s corps'
        )
        expect(standingGroupName(AUSTERLITZ, unit({ position: { locale: 93 } }))).toBe(
            'Detached, in reserve'
        )
        expect(
            standingGroupName(
                AUSTERLITZ,
                unit({ position: { locale: 93, approach: approach.id } })
            )
        ).toBe('Detached, facing locale 94')
    })
})
