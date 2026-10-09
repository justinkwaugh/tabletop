import { expect, test, type Locator, type Page } from '@playwright/test'
import type { WrapperFixtureProps } from '../src/lib/components/tests/scalingWrapper.fixture.js'

async function mountWrapper(page: Page, props: WrapperFixtureProps = {}) {
    await page.goto('/session-test.html')
    await page.evaluate(async (props) => {
        const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
        mountWrapper(props)
    }, props)
}

function viewportOffset(board: Locator) {
    return board.evaluate(element => {
        const surface = element.closest('.scaling-surface')
        if (!surface) throw new Error('Missing scaling surface')
        const style = getComputedStyle(surface)
        const boardBounds = element.getBoundingClientRect()
        const surfaceBounds = surface.getBoundingClientRect()
        return {
            x: boardBounds.x - surfaceBounds.x - parseFloat(style.paddingLeft),
            y: boardBounds.y - surfaceBounds.y - parseFloat(style.paddingTop)
        }
    })
}

test('trackpad pan hands remaining movement and momentum to the enclosing table', async ({ page }) => {
    await mountWrapper(page, { scrollable: true })
    const board = page.getByTestId('board')
    const table = page.getByTestId('table-scroll')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    await table.evaluate(element => { element.scrollLeft = 400 })
    await board.dispatchEvent('wheel', { deltaY: -200, clientX: 200, clientY: 150 })
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.6), 1)
    await board.dispatchEvent('wheel', { deltaX: -20, clientX: 200, clientY: 150 })
    expect(await table.evaluate(element => element.scrollLeft)).toBe(400)
    await board.dispatchEvent('wheel', { deltaX: -250, clientX: 200, clientY: 150 })
    const afterPan = await table.evaluate(element => element.scrollLeft)
    expect(afterPan).toBeLessThan(400)
    expect(afterPan).toBeGreaterThan(0)
    let expectedScroll = afterPan
    for (const deltaX of [-30, -15, -5]) {
        await board.dispatchEvent('wheel', { deltaX, clientX: 200, clientY: 150 })
        expectedScroll += deltaX
        await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBe(expectedScroll)
    }
})

test('full screen keeps the table and page behind it from scrolling', async ({ page }) => {
    await mountWrapper(page, { maxScale: 2, expandable: true, scrollable: true })
    const board = page.getByTestId('board')
    const table = page.getByTestId('table-scroll')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    await page.evaluate(() => {
        document.body.append(Object.assign(document.createElement('div'), { style: 'height:3000px' }))
        window.scrollTo(0, 50)
    })
    await table.evaluate(element => { element.scrollLeft = 400 })
    await page.getByLabel('Enter full screen').click()
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(880)
    await board.dispatchEvent('wheel', { deltaX: -250, deltaY: 30, clientX: 640, clientY: 360 })
    const zoomIn = page.getByLabel('Zoom in')
    await zoomIn.hover()
    await page.mouse.wheel(0, 400)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    expect(await table.evaluate(element => element.scrollLeft)).toBe(400)
    expect(await page.evaluate(() => window.scrollY)).toBe(50)
    await page.getByLabel('Exit full screen').click()
    await board.dispatchEvent('wheel', { deltaX: -250, clientX: 200, clientY: 150 })
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeLessThan(400)
})

test('mouse wheel zooms and dragging pans without clicking the board', async ({ page }) => {
    await mountWrapper(page)
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    await page.mouse.move(200, 150)
    await page.mouse.wheel(0, -200)
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.6), 1)
    const before = await board.boundingBox()
    if (!before) throw new Error('Missing board')
    await page.mouse.down()
    await page.mouse.move(250, 190, { steps: 5 })
    await page.mouse.up()
    const after = await board.boundingBox()
    if (!after) throw new Error('Missing board')
    expect(after.x).toBeCloseTo(before.x + 50)
    expect(after.y).toBeCloseTo(before.y + 40)
    await expect(page.locator('output')).toHaveText('0')
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
    expect(await board.evaluate(element => {
        const style = getComputedStyle(element)
        return style.getPropertyValue('user-select') || style.getPropertyValue('-webkit-user-select')
    })).toBe('none')
    await page.mouse.click(250, 190)
    await expect(page.locator('output')).toHaveText('1')
    await page.mouse.wheel(0, 2000)
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
})

test('smooth trackpad gestures pan, including their faster continuation, and pinch zooms', async ({ page }) => {
    await mountWrapper(page)
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    await page.mouse.move(200, 150)
    await page.mouse.wheel(0, -200)
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.6), 1)
    const before = await board.boundingBox()
    if (!before) throw new Error('Missing board')
    await board.dispatchEvent('wheel', { deltaY: 10, deltaX: 8, clientX: 200, clientY: 150 })
    await board.dispatchEvent('wheel', { deltaY: 60, clientX: 200, clientY: 150 })
    await expect.poll(async () => (await board.boundingBox())?.y).toBeCloseTo(before.y - 70)
    const after = await board.boundingBox()
    if (!after) throw new Error('Missing board')
    expect(after.width).toBeCloseTo(before.width)
    expect(after.x).toBeCloseTo(before.x - 8)
    expect(after.y).toBeCloseTo(before.y - 70)
    await board.dispatchEvent('wheel', { deltaY: -20, ctrlKey: true, clientX: 200, clientY: 150 })
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(before.width * Math.exp(0.12), 1)
})

for (const maximum of [1, 2]) {
    test(`manual zoom respects maximum ${maximum}`, async ({ page }) => {
        await mountWrapper(page, { maxScale: maximum })
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        await page.mouse.move(200, 150)
        await page.mouse.wheel(0, -2000)
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(1000 * maximum)
        await page.mouse.wheel(0, 2000)
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    })
}

test('a board drawn below the cover scale rests filling its short side and still zooms out to fit whole', async ({ page }) => {
    await mountWrapper(page, { coverBelowScale: 0.3, boardWidth: 2000, boardHeight: 500 })
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.height).toBe(300)
    expect((await viewportOffset(board)).x).toBeCloseTo(-400)
    await page.mouse.move(200, 150)
    await page.mouse.wheel(0, 2000)
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(400)
})

test('a board drawn at or above the cover scale rests whole', async ({ page }) => {
    await mountWrapper(page, { coverBelowScale: 0.3, boardWidth: 1000, boardHeight: 500 })
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(400)
})

for (const mode of ['pan', 'pinch', 'gesture']) {
    test(`${mode} renders a burst of trackpad updates once per frame`, async ({ page }) => {
        await mountWrapper(page, { maxScale: 2 })
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        await board.dispatchEvent('wheel', { deltaY: -200, clientX: 200, clientY: 150 })
        await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.6), 1)
        const result = await board.evaluate(async (element, mode) => {
            const content = element.parentElement?.parentElement
            if (!content) throw new Error('Missing transform container')
            const before = element.getBoundingClientRect()
            let writes = 0
            const observer = new MutationObserver(records => writes += records.length)
            observer.observe(content, { attributes: true, attributeFilter: ['style'] })
            if (mode === 'gesture') element.dispatchEvent(Object.assign(new Event('gesturestart', { bubbles: true, cancelable: true }), { scale: 1 }))
            for (let index = 0; index < 12; index++) {
                element.dispatchEvent(mode === 'gesture'
                    ? Object.assign(new Event('gesturechange', { bubbles: true, cancelable: true }), { scale: 1 + (index + 1) / 100 })
                    : new WheelEvent('wheel', { bubbles: true, cancelable: true,
                        deltaX: mode === 'pan' ? 1 : 0, deltaY: mode === 'pinch' ? -1 : 0,
                        ctrlKey: mode === 'pinch', clientX: 200, clientY: 150 }))
            }
            if (mode === 'gesture') element.dispatchEvent(new Event('gestureend', { bubbles: true }))
            await new Promise(requestAnimationFrame)
            await new Promise(requestAnimationFrame)
            observer.disconnect()
            const after = element.getBoundingClientRect()
            return { writes, beforeWidth: before.width, afterWidth: after.width, movement: after.x - before.x }
        }, mode)
        expect(result.writes).toBe(1)
        if (mode === 'pan') expect(result.movement).toBeCloseTo(-12, 1)
        else expect(result.afterWidth).toBeCloseTo(result.beforeWidth * (mode === 'pinch' ? Math.exp(0.072) : Math.pow(1.12, 1.2)), 1)
    })
}

for (const transition of ['modal mount', 'fullscreen'] as const) {
    test(`first painted frame is settled on ${transition}`, async ({ page }) => {
        await page.goto('/session-test.html')
        if (transition === 'fullscreen') {
            await mountWrapper(page, { expandable: true })
            await expect.poll(async () => (await page.getByTestId('board').boundingBox())?.width).toBe(375)
        }
        const frames = await page.evaluate(async transition => {
            const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
            if (transition === 'modal mount') mountWrapper({ modal: true })
            else {
                const button = document.querySelector('[aria-label="Enter full screen"]')
                if (!(button instanceof HTMLElement)) throw new Error('Missing fullscreen control')
                button.click()
            }
            const frames: { width: number; x: number; y: number }[] = []
            for (let index = 0; index < 5; index++) {
                await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
                const board = document.querySelector('[data-testid="board"]')
                if (!board) throw new Error('Missing board')
                const bounds = board.getBoundingClientRect()
                frames.push({ width: bounds.width, x: bounds.x, y: bounds.y })
            }
            return frames
        }, transition)
        expect(frames).toEqual(frames.map(() => frames.at(-1)))
    })
}

for (const [overpan, gestureOverpanReach, expected] of [
    ['none', undefined, { x: 0, y: 0 }],
    ['x', undefined, { x: 200, y: 0 }],
    ['both', undefined, { x: 200, y: 150 }],
    ['focus', undefined, { x: 0, y: 0 }],
    ['focus', 0.3, { x: 120, y: 90 }]
] as const) {
    test(`dragging a slightly zoomed map with ${overpan} overpan${gestureOverpanReach ? ` reaching ${gestureOverpanReach}` : ''} brings edges at most to its reach`, async ({ page }) => {
        await mountWrapper(page, { overpan, gestureOverpanReach })
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        const drag = async () => {
            await page.mouse.move(200, 150)
            await page.mouse.down()
            await page.mouse.move(600, 450, { steps: 5 })
            await page.mouse.up()
        }
        await drag()
        expect(await viewportOffset(board)).toEqual({ x: 12.5, y: 0 })
        await page.mouse.move(200, 150)
        await page.mouse.wheel(0, -60)
        await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.18), 1)
        await drag()
        const dragged = await viewportOffset(board)
        expect(dragged.x).toBeCloseTo(expected.x)
        expect(dragged.y).toBeCloseTo(expected.y)
        await page.mouse.move(200, 150)
        await page.mouse.wheel(0, 2000)
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        expect(await viewportOffset(board)).toEqual({ x: 12.5, y: 0 })
    })
}

for (const [overpan, expected] of [['none', { x: 0, y: 0 }], ['focus', { x: 150, y: 100 }]] as const) {
    test(`focusing an edge target with ${overpan} overpan`, async ({ page }) => {
        await mountWrapper(page, { scrollable: true, overpan, focus: { x: 0, y: 0, width: 100, height: 100 } })
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(1000)
        const focused = await viewportOffset(board)
        expect(focused.x).toBeCloseTo(expected.x)
        expect(focused.y).toBeCloseTo(expected.y)
    })
}

test('gestures shrink a focus overpan but never grow it, handing outward movement to the table', async ({ page }) => {
    await mountWrapper(page, { scrollable: true, overpan: 'focus', focus: { x: 0, y: 0, width: 100, height: 100 } })
    const board = page.getByTestId('board')
    const table = page.getByTestId('table-scroll')
    await table.evaluate(element => { element.scrollLeft = 400 })
    await expect.poll(async () => (await viewportOffset(board)).x).toBeCloseTo(150)
    await board.dispatchEvent('wheel', { deltaX: -20, clientX: 200, clientY: 150 })
    expect((await viewportOffset(board)).x).toBeCloseTo(150)
    expect(await table.evaluate(element => element.scrollLeft)).toBe(380)
    await board.dispatchEvent('wheel', { deltaX: 50, clientX: 200, clientY: 150 })
    await expect.poll(async () => (await viewportOffset(board)).x).toBeCloseTo(100)
    expect(await table.evaluate(element => element.scrollLeft)).toBe(380)
    await board.dispatchEvent('wheel', { deltaX: -30, clientX: 200, clientY: 150 })
    await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBe(350)
    expect((await viewportOffset(board)).x).toBeCloseTo(100)
    await page.mouse.move(200, 150)
    await page.mouse.down()
    await page.mouse.move(200, 110, { steps: 4 })
    await page.mouse.move(200, 250, { steps: 4 })
    await page.mouse.up()
    expect((await viewportOffset(board)).y).toBeCloseTo(60)
})

for (const [overpan, expected] of [['none', { x: 0, y: 0 }], ['focus', { x: 632, y: 352 }]] as const) {
    test(`full screen dragging with ${overpan} overpan stops at its reach`, async ({ page }) => {
        await mountWrapper(page, { maxScale: 2, expandable: true, overpan })
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        await page.getByLabel('Enter full screen').click()
        await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(880)
        await page.mouse.move(640, 360)
        await page.mouse.wheel(0, -200)
        await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(880 * Math.exp(0.6), 1)
        for (let pass = 0; pass < 2; pass++) {
            await page.mouse.move(640, 360)
            await page.mouse.down()
            await page.mouse.move(1270, 715, { steps: 5 })
            await page.mouse.up()
        }
        const offset = await viewportOffset(board)
        expect(offset.x).toBeCloseTo(expected.x, 0)
        expect(offset.y).toBeCloseTo(expected.y, 0)
    })
}

test('content drawn at its view scale is laid out at that scale once the view settles', async ({ page }) => {
    await mountWrapper(page, { renderAtViewScale: true })
    const board = page.getByTestId('board')
    const drawn = () => board.evaluate(element => {
        const zoomed = element.parentElement as HTMLElement
        return {
            zoom: Number(zoomed.style.zoom),
            transform: (zoomed.parentElement as HTMLElement).style.transform,
            ownWidth: (element as HTMLElement).offsetWidth
        }
    })
    // The 1000 px board fits the 400 px view at 0.375 and is laid out there, not stretched to it
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    expect(await drawn()).toMatchObject({ zoom: 0.375, ownWidth: 1000 })
    expect((await drawn()).transform).toContain('scale(1)')

    await board.dispatchEvent('wheel', { deltaY: -200, clientX: 200, clientY: 150 })
    const zoomedWidth = 375 * Math.exp(0.6)
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(zoomedWidth, 1)
    const before = await board.boundingBox()
    await expect.poll(async () => (await drawn()).zoom).toBeCloseTo(zoomedWidth / 1000, 3)
    expect((await drawn()).transform).toContain('scale(1)')
    // Redrawing moves nothing on screen, and the content still takes clicks
    const after = await board.boundingBox()
    expect(after!.x).toBeCloseTo(before!.x, 0)
    expect(after!.width).toBeCloseTo(before!.width, 0)
    await board.click()
    await expect(page.locator('output')).toHaveText('1')
})

test('a small board rests at full size unless it may fit larger, and still zooms to the max', async ({ page }) => {
    await mountWrapper(page, { maxScale: 2, boardWidth: 100, boardHeight: 80 })
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(100)
    await page.reload()
    await mountWrapper(page, { maxScale: 2, maxFitScale: 1.5, boardWidth: 100, boardHeight: 80 })
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(150)
    await board.dispatchEvent('wheel', { deltaY: -400, clientX: 200, clientY: 150 })
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(200)
})
