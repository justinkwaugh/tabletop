import { describe, expect, it } from 'vitest'
import { resolvePreferences } from '@tabletop/common'
import { LyngkPreferenceDefinition } from './preferences.js'

describe('preferences', () => {
    it('shows coordinates and the near side by default', () => {
        const resolved = resolvePreferences(LyngkPreferenceDefinition, {
            title: { version: 2, revision: 1, values: {} }
        })
        expect(resolved).toEqual({ showCoordinates: true, turned: false })
    })
})
