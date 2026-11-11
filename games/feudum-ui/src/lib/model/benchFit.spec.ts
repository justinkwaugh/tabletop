import { describe, expect, it } from 'vitest'
import { GuildBox } from '$lib/utils/boardGeometry.js'
import { fittedAreaWidth } from './benchFit.svelte.js'

describe('fittedAreaWidth (contract: Phone layout, the bench)', () => {
    it('shares the room under the title and over the footer between the pictures', () => {
        const width = fittedAreaWidth({
            sheet: 675,
            title: 28,
            footer: 143,
            padding: 24,
            gap: 12,
            around: [0, 0]
        })
        const picture = (675 - 28 - 143 - 24 - 12) / 2
        expect(width).toBe(Math.floor((picture * GuildBox.width) / GuildBox.height))
        expect((width * GuildBox.height) / GuildBox.width).toBeLessThanOrEqual(picture)
    })

    it('leaves room for each area’s button row', () => {
        const bare = { sheet: 675, title: 28, footer: 100, padding: 24, gap: 12 }
        const plain = fittedAreaWidth({ ...bare, around: [0, 0] })
        const withButtons = fittedAreaWidth({ ...bare, around: [48, 0] })
        expect(withButtons).toBeLessThan(plain)
        expect(withButtons).toBe(
            Math.floor((((675 - 28 - 100 - 24 - 12 - 48) / 2) * GuildBox.width) / GuildBox.height)
        )
    })

    it('one area takes the whole room', () => {
        const width = fittedAreaWidth({
            sheet: 600,
            title: 28,
            footer: 100,
            padding: 24,
            gap: 12,
            around: [0]
        })
        expect(width).toBe(Math.floor(((600 - 28 - 100 - 24) * GuildBox.width) / GuildBox.height))
    })
})
