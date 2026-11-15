import { describe, expect, it } from 'vitest'
import type { RailroadCard } from '$lib/utils/marginTracks.js'
import { railroadCardLabel, railroadPileLabel } from './railroadCards.js'

const ORANGE: RailroadCard = {
    railroadId: 'railroad.orange',
    supply: 27,
    shareholders: [
        { playerId: 'p1', shares: 1 },
        { playerId: 'p2', shares: 2 }
    ]
}

const names: Record<string, string> = { p1: 'Ada', p2: 'Ben' }
const nameOf = (playerId: string) => names[playerId] ?? playerId

describe('a railroad’s accessible name', () => {
    it('on a desktop card says its supply, not its track or its holders', () => {
        expect(railroadCardLabel(ORANGE)).toBe('Orange: 27 left')
    })

    it('on a phone’s pile names its holders too, as the seat cards are off screen, not its track', () => {
        expect(railroadPileLabel(ORANGE, nameOf)).toBe('Orange: 27 left, shares Ada 1, Ben 2')
    })

    it('on a phone’s pile names no holders while nobody holds a share', () => {
        expect(railroadPileLabel({ ...ORANGE, supply: 0, shareholders: [] }, nameOf)).toBe(
            'Orange: none left'
        )
    })
})
