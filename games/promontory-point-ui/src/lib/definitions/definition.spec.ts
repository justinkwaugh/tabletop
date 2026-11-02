import { describe, expect, it } from 'vitest'
import { GameClientCapability } from '@tabletop/common'
import { UiDefinition } from './definition.js'

describe('UI definition', () => {
    // docs/player-votes.md, "Called games and UI Artifacts": without it the Site Frontend offers
    // no Concede or Call the game, and the backend refuses a call or the stalled-game sweep.
    it('declares the calledGames client capability', () => {
        expect(UiDefinition.info.clientCapabilities).toContain(GameClientCapability.CalledGames)
    })
})
