import { describe, expect, it } from 'vitest'
import { resolvePreferences } from '@tabletop/common'
import { LyngkPreferenceDefinition } from './preferences.js'

describe('preferences', () => {
    it('drops the light or dark board saved by version 1', () => {
        const resolved = resolvePreferences(LyngkPreferenceDefinition, {
            title: { version: 1, revision: 1, values: { lightBoard: false } }
        })
        expect(resolved).toEqual({ showCoordinates: true })
    })
})
