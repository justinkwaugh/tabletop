import { describe, expect, it } from 'vitest'
import { BUG_REPORT_SCREENSHOT_MAX_BYTES } from '@tabletop/common'
import { pastedImages, shrinkUntilFits } from './screenshot'

describe('pastedImages', () => {
    const png = new File(['png'], 'shot.png', { type: 'image/png' })
    const heic = new File(['heic'], 'photo.heic', { type: 'image/heic' })
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain' })

    it('keeps only the images among pasted files', () => {
        expect(pastedImages(['Files'], [png, text, heic])).toEqual([png, heic])
    })

    it('takes no image from a paste that carries text', () => {
        expect(pastedImages(['text/plain', 'text/html', 'Files'], [png])).toEqual([])
    })
})

describe('shrinkUntilFits', () => {
    function encoderByScale(bytesAt: (scale: number) => number) {
        const scales: number[] = []
        const encodeAt = async (scale: number) => {
            scales.push(scale)
            return new Blob([new Uint8Array(bytesAt(scale))])
        }
        return { scales, encodeAt }
    }

    it('keeps the first encoding when it fits', async () => {
        const { scales, encodeAt } = encoderByScale(() => BUG_REPORT_SCREENSHOT_MAX_BYTES)

        const encoded = await shrinkUntilFits(encodeAt, 0.5)

        expect(encoded.size).toBe(BUG_REPORT_SCREENSHOT_MAX_BYTES)
        expect(scales).toEqual([0.5])
    })

    it('scales the image down until the encoding fits', async () => {
        const { scales, encodeAt } = encoderByScale((scale) =>
            Math.round(BUG_REPORT_SCREENSHOT_MAX_BYTES * 2 * scale * scale)
        )

        const encoded = await shrinkUntilFits(encodeAt, 1)

        expect(encoded.size).toBeLessThanOrEqual(BUG_REPORT_SCREENSHOT_MAX_BYTES)
        expect(scales.length).toBeGreaterThan(1)
        expect(scales).toEqual([...scales].sort((a, b) => b - a))
    })
})
