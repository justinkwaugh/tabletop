import { describe, expect, it } from 'vitest'
import { GuildBox } from '$lib/utils/boardGeometry.js'
import { BenchFit, type BenchRoom } from './benchFit.svelte.js'

function fitted(room: BenchRoom): number | undefined {
    const fit = new BenchFit()
    fit.fit(room)
    return fit.long
}

const Room = { height: 675, width: 2000, title: 28, footer: 143, padding: 24, gap: 12 }

describe('the bench fits its areas (contract: The bench, Phone layout)', () => {
    it('stands the upright areas side by side in the height under the title and over the footer', () => {
        expect(fitted({ ...Room, around: [0, 0] })).toBe(675 - 28 - 143 - 24)
    })

    it('leaves room for the tallest button row', () => {
        expect(fitted({ ...Room, around: [48, 0] })).toBe(675 - 28 - 143 - 24 - 48)
    })

    it('a narrow holder shares its width between the areas at the area’s own shape', () => {
        const long = fitted({ ...Room, width: 366, around: [0, 0] })
        expect(long).toBe(Math.floor((((366 - 12) / 2) * GuildBox.width) / GuildBox.height))
        expect(((long ?? Infinity) * GuildBox.height) / GuildBox.width).toBeLessThanOrEqual(
            (366 - 12) / 2
        )
    })

    it('one area takes the whole width', () => {
        const long = fitted({ ...Room, width: 300, around: [0] })
        expect(long).toBe(Math.floor((300 * GuildBox.width) / GuildBox.height))
    })
})
