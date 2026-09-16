import { expect, test } from '@playwright/test'

test('trackpad pan hands remaining movement and momentum to the enclosing table', async ({ page }) => {
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
        mountWrapper(1, true)
    })
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

test('mouse wheel zooms and dragging pans without clicking the board', async ({ page }) => {
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
        mountWrapper()
    })
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
    await page.goto('/session-test.html')
    await page.evaluate(async () => {
        const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
        mountWrapper()
    })
    const board = page.getByTestId('board')
    await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    await page.mouse.move(200, 150)
    await page.mouse.wheel(0, -200)
    await expect.poll(async () => (await board.boundingBox())?.width).toBeCloseTo(375 * Math.exp(0.6), 1)
    const before = await board.boundingBox()
    if (!before) throw new Error('Missing board')
    await board.dispatchEvent('wheel', { deltaY: 10, deltaX: 8, clientX: 200, clientY: 150 })
    await board.dispatchEvent('wheel', { deltaY: 60, clientX: 200, clientY: 150 })
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
        await page.goto('/session-test.html')
        await page.evaluate(async (maxScale) => {
            const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
            mountWrapper(maxScale)
        }, maximum)
        const board = page.getByTestId('board')
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
        await page.mouse.move(200, 150)
        await page.mouse.wheel(0, -2000)
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(1000 * maximum)
        await page.mouse.wheel(0, 2000)
        await expect.poll(async () => (await board.boundingBox())?.width).toBe(375)
    })
}

for (const mode of ['pan', 'pinch', 'gesture']) {
    test(`${mode} renders a burst of trackpad updates once per frame`, async ({ page }) => {
        await page.goto('/session-test.html')
        await page.evaluate(async () => {
            const { mountWrapper } = await import(new URL('/src/lib/components/tests/scalingWrapper.fixture.ts', location.href).href)
            mountWrapper(2)
        })
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
