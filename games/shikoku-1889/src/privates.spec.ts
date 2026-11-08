import { describe, expect, it } from 'vitest'
import { placeReference } from '@tabletop/18xx'
import { Shikoku1889Privates } from './privates.js'

describe('Shikoku 1889 privates', () => {
    it('names every blocked place in the description', () => {
        for (const company of Shikoku1889Privates) {
            for (const locationId of company.blocks?.locationIds ?? []) {
                expect(company.description, company.id).toContain(
                    `Blocks ${placeReference(locationId)} while player-owned.`
                )
            }
        }
    })
})
