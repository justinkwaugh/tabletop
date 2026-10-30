import { expect, test, type Page } from '@playwright/test'

// iPhone Safari's scroll rounding and listener costs are WebKit's.
test.use({ browserName: 'webkit' })

type ChainSetup = {
    outerContent?: number
    innerContent: number
    innerLeft: number
    pageContent?: number
    pageLeft?: number
    zoom?: number
}

/**
 * Builds a sideways scroller, optionally inside another, and records the window scrolls the chain
 * asks for, since iOS lets a script push the page past its edges.
 */
async function chainSidewaysSwipe(page: Page, setup: ChainSetup, fingerDelta: number) {
    await page.goto('/session-test.html')
    return page.evaluate(
        async ({ setup, fingerDelta }) => {
            const { scrollAncestorsWithFinger } = await import(
                new URL('/src/lib/utils/scrollChain.ts', location.href).href
            )
            document.body.style.margin = '0'
            document.body.style.width = `${setup.pageContent ?? 0}px`
            const scroller = (contentWidth: number) => {
                const element = document.createElement('div')
                element.style.cssText = 'width: 100px; height: 50px; overflow: auto'
                const content = document.createElement('div')
                content.style.cssText = `width: ${contentWidth}px; height: 10px`
                element.append(content)
                return { element, content }
            }
            const inner = scroller(setup.innerContent)
            const outer =
                setup.outerContent === undefined ? undefined : scroller(setup.outerContent)
            const zoomed = document.createElement('div')
            zoomed.style.zoom = String(setup.zoom ?? 1)
            document.body.append(zoomed)
            if (outer) {
                outer.content.append(inner.element)
                zoomed.append(outer.element)
                outer.element.scrollLeft = 100
            } else {
                zoomed.append(inner.element)
            }
            inner.element.scrollLeft = setup.innerLeft
            window.scrollTo({ left: setup.pageLeft ?? 0 })
            const windowScrolls: number[] = []
            const scrollBy = window.scrollBy.bind(window)
            window.scrollBy = (options?: ScrollToOptions) => {
                windowScrolls.push(options?.left ?? 0)
                scrollBy(options)
            }
            const innerStart = inner.element.scrollLeft
            const moved = scrollAncestorsWithFinger(inner.content, 'x', fingerDelta)
            return {
                moved,
                innerStart,
                innerLeft: inner.element.scrollLeft,
                outerLeft: outer?.element.scrollLeft,
                windowScrolls
            }
        },
        { setup, fingerDelta }
    )
}

test.describe('touch scroll chain in WebKit, which rounds scroll positions down', () => {
    test('a scroller short of its edge keeps a sub-pixel shortfall from the page', async ({
        page
    }) => {
        const result = await chainSidewaysSwipe(page, { innerContent: 500, innerLeft: 200 }, 13.7)
        expect(result.innerLeft).toBe(186)
        expect(result.windowScrolls).toEqual([])
    })

    test('a zoomed scroller that stops a pixel short of its range still hands on at its edge', async ({
        page
    }) => {
        const result = await chainSidewaysSwipe(
            page,
            { outerContent: 400, innerContent: 155.18, innerLeft: 1000, zoom: 1.286 },
            -20
        )
        expect(result.innerLeft).toBe(result.innerStart)
        expect(result.outerLeft).toBe(120)
    })

    test('a page with no room to scroll is not pushed', async ({ page }) => {
        const result = await chainSidewaysSwipe(page, { innerContent: 500, innerLeft: 5 }, 20)
        expect(result.innerLeft).toBe(0)
        expect(result.moved).toBe(5)
        expect(result.windowScrolls).toEqual([])
    })

    test('the page takes only the room it has', async ({ page }) => {
        const result = await chainSidewaysSwipe(
            page,
            { innerContent: 500, innerLeft: 0, pageContent: 3000, pageLeft: 10 },
            50
        )
        expect(result.windowScrolls).toEqual([-10])
    })
})

test.describe('stopping a fling', () => {
    async function startFling(page: Page) {
        await page.goto('/session-test.html')
        await page.evaluate(async () => {
            const { fling } = await import(
                new URL('/src/lib/utils/touchFling.ts', location.href).href
            )
            const scroller = document.createElement('div')
            scroller.id = 'scroller'
            scroller.innerHTML = '<span id="cell"></span>'
            const elsewhere = document.createElement('div')
            elsewhere.id = 'elsewhere'
            document.body.append(scroller, elsewhere)
            const added: string[] = []
            const addEventListener = EventTarget.prototype.addEventListener
            EventTarget.prototype.addEventListener = function (...args) {
                added.push(args[0])
                return addEventListener.apply(this, args)
            }
            const flung = fling(
                { x: 1, y: 0 },
                0,
                (offset: { x: number; y: number }) => offset,
                scroller
            )
            Object.assign(window, { flung, added })
        })
    }

    const running = (page: Page) =>
        page.evaluate(() => Reflect.get(Reflect.get(window, 'flung'), 'running'))

    test('adds no listeners as it starts, since WebKit restyles the page for each', async ({
        page
    }) => {
        await startFling(page)
        expect(await page.evaluate(() => Reflect.get(window, 'added'))).toEqual([])
    })

    test('stops on a touch inside its scroller, not on a touch elsewhere', async ({ page }) => {
        await startFling(page)
        const touch = (id: string) =>
            page.evaluate(
                (id) =>
                    document
                        .getElementById(id)
                        ?.dispatchEvent(new Event('touchstart', { bubbles: true })),
                id
            )
        await touch('elsewhere')
        expect(await running(page)).toBe(true)
        await touch('cell')
        expect(await running(page)).toBe(false)
    })
})
