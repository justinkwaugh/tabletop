import { describe, expect, it } from 'vitest'
import { GameClientCapability } from '@tabletop/common'
import { UiDefinition } from './definition.js'

describe('UiDefinition', () => {
    it('lets players concede or call a game, and a stalled game end', () => {
        expect(UiDefinition.info.clientCapabilities).toContain(GameClientCapability.CalledGames)
    })
})
