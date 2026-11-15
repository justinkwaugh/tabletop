import { expect, it } from 'vitest'
import { placeReference } from '@tabletop/18xx'
import { Shikoku1889Privates } from './privates.js'

it('names every blocked place in the private’s description', () => {
    for (const company of Shikoku1889Privates)
        for (const locationId of company.blocks?.locationIds ?? [])
            expect(company.description, company.id).toContain(placeReference(locationId))
})
