import { describe, expect, it } from 'vitest'
import { RideTheRailsInfo } from '@tabletop/ride-the-rails'
import { UiDefinition } from './definition.js'

describe('UiDefinition', () => {
    it('carries the logic package metadata', () => {
        expect(UiDefinition.info.id).toBe(RideTheRailsInfo.id)
        expect(UiDefinition.info.metadata).toEqual(RideTheRailsInfo.metadata)
    })

    it('has a thumbnail for the catalogue', () => {
        expect(UiDefinition.info.thumbnailUrl).toBeTruthy()
    })
})
