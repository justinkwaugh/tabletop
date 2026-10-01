import { describe, expect, it } from 'vitest'
import { OathType } from '@tabletop/oath'
import { goalCardPreview, reliquaryTraitPreview } from './seatPreviews.js'

describe('seat card previews go through the shared enlarged card', () => {
    it('an uncovered Reliquary space previews its trait, labelled as the Chancellor’s', () => {
        const preview = reliquaryTraitPreview(1, 'Reliquary space 2')
        expect(preview.back).toBeUndefined()
        expect(preview.imageSrc).toContain('trait.decadent')
        expect(preview.label).toBe('Reliquary space 2, uncovered: the Chancellor holds this trait')
    })

    it('a goal previews the whole goal card for the Oath sworn', () => {
        const preview = goalCardPreview(OathType.Supremacy, 'Oathkeeper of Supremacy')
        expect(preview.imageSrc).toContain('goal.supremacy')
        expect(preview.aspect).toBeCloseTo(662 / 898)
        expect(preview.label).toBe('Oathkeeper of Supremacy')
    })
})
