import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recoverFailedImages } from './failedImageRecovery.js'

class FakeImage extends EventTarget {
    isConnected = true
    reloads = 0
    private readonly attributes = new Map<string, { name: string; value: string }>()

    constructor(name: string, value: string) {
        super()
        this.attributes.set(name, { name, value })
    }

    getAttributeNode(name: string) {
        return this.attributes.get(name) ?? null
    }

    removeAttributeNode(attribute: { name: string }) {
        this.attributes.delete(attribute.name)
    }

    setAttributeNode(attribute: { name: string; value: string }) {
        this.attributes.set(attribute.name, attribute)
        this.reloads += 1
    }
}

class FakeHtmlImage extends FakeImage {
    constructor(source: string) {
        super('src', source)
    }
}

class FakeSvgImage extends FakeImage {}

class FakeDocument extends EventTarget {
    hidden = false
}

function fire(pageDocument: FakeDocument, type: string, target: EventTarget) {
    const event = new Event(type)
    Object.defineProperty(event, 'target', { value: target })
    pageDocument.dispatchEvent(event)
}

describe('recoverFailedImages', () => {
    let pageDocument: FakeDocument
    let pageWindow: EventTarget

    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('HTMLImageElement', FakeHtmlImage)
        vi.stubGlobal('SVGImageElement', FakeSvgImage)
        pageDocument = new FakeDocument()
        pageWindow = new EventTarget()
        recoverFailedImages(pageDocument, pageWindow)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    function failEveryRetry(image: FakeImage) {
        fire(pageDocument, 'error', image)
        for (const delay of [1_000, 3_000, 10_000]) {
            vi.advanceTimersByTime(delay)
            fire(pageDocument, 'error', image)
        }
    }

    it('reloads a failed image from the same address', () => {
        const image = new FakeHtmlImage('/logo.svg')
        fire(pageDocument, 'error', image)

        vi.advanceTimersByTime(1_000)

        expect(image.reloads).toBe(1)
        expect(image.getAttributeNode('src')?.value).toBe('/logo.svg')
    })

    it.each(['href', 'xlink:href'])('reloads a failed SVG image linked by %s', (attribute) => {
        const image = new FakeSvgImage(attribute, '/token.svg')
        fire(pageDocument, 'error', image)

        vi.advanceTimersByTime(1_000)

        expect(image.reloads).toBe(1)
        expect(image.getAttributeNode(attribute)?.value).toBe('/token.svg')
    })

    it('stops retrying after three failures', () => {
        const image = new FakeHtmlImage('/missing.svg')
        failEveryRetry(image)

        vi.advanceTimersByTime(60_000)

        expect(image.reloads).toBe(3)
    })

    it('does not retry an image that has since loaded', () => {
        const image = new FakeHtmlImage('/logo.svg')
        fire(pageDocument, 'error', image)
        fire(pageDocument, 'load', image)

        vi.advanceTimersByTime(60_000)

        expect(image.reloads).toBe(0)
    })

    it('leaves images alone once they leave the page or change address', () => {
        const removed = new FakeHtmlImage('/removed.svg')
        const replaced = new FakeHtmlImage('/old.svg')
        fire(pageDocument, 'error', removed)
        fire(pageDocument, 'error', replaced)
        removed.isConnected = false
        replaced.setAttributeNode({ name: 'src', value: '/new.svg' })
        replaced.reloads = 0

        vi.advanceTimersByTime(60_000)

        expect(removed.reloads).toBe(0)
        expect(replaced.reloads).toBe(0)
    })

    it('does not retry inline image data', () => {
        const image = new FakeHtmlImage('blob:https://example.test/1')
        fire(pageDocument, 'error', image)

        vi.advanceTimersByTime(60_000)

        expect(image.reloads).toBe(0)
    })

    it('waits for the page to return before retrying a hidden image', () => {
        const image = new FakeHtmlImage('/logo.svg')
        pageDocument.hidden = true
        fire(pageDocument, 'error', image)
        vi.advanceTimersByTime(60_000)
        expect(image.reloads).toBe(0)

        pageDocument.hidden = false
        pageDocument.dispatchEvent(new Event('visibilitychange'))

        expect(image.reloads).toBe(1)
    })

    it('tries again after retries ran out when the network returns', () => {
        const image = new FakeHtmlImage('/logo.svg')
        failEveryRetry(image)

        pageWindow.dispatchEvent(new Event('online'))

        expect(image.reloads).toBe(4)
    })
})
