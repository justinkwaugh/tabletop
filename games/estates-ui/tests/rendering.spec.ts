import { expect, test } from '@playwright/test'
import { createGame, drawCount, expectIdle, waitForFrames } from './helpers'

test('the board and HTML overlays render on demand', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
        let draws = 0
        const original = WebGL2RenderingContext.prototype.drawElements
        WebGL2RenderingContext.prototype.drawElements = function (...args) {
            document.documentElement.dataset.draws = String(++draws)
            return original.apply(this, args)
        }
    })

    await createGame(page)
    await expect(async () => {
        expect(errors).toEqual([])
        expect(await drawCount(page)).toBeGreaterThan(0)
    }).toPass({ timeout: 15_000 })
    await expectIdle(page)

    const stealButton = page.getByRole('button', { name: 'Steal $1 First', exact: true })
    await stealButton.click()
    await expect(stealButton).toBeHidden()
    await expect(page.getByText('$11', { exact: true })).toBeVisible()
    await expectIdle(page)

    const playerTransforms = () =>
        page
            .locator('[style*="matrix3d"]')
            .evaluateAll((elements) => elements.map((element) => element.getAttribute('style')))
    expect((await playerTransforms()).length).toBeGreaterThan(0)
    for (const moveCamera of [
        async () => {
            await page.mouse.move(800, 550)
            await page.mouse.down()
            await page.mouse.move(930, 590, { steps: 10 })
            await page.mouse.up()
        },
        async () => {
            await page.mouse.move(930, 590)
            await page.mouse.down()
            await page.mouse.move(800, 550, { steps: 10 })
            await page.mouse.up()
        },
        async () => {
            await page.mouse.move(800, 550)
            await page.mouse.wheel(0, -150)
        }
    ]) {
        const beforeCamera = await playerTransforms()
        const beforeDraws = await drawCount(page)
        await moveCamera()
        await page.mouse.move(10, 80)
        await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeDraws)
        await expect.poll(playerTransforms).not.toEqual(beforeCamera)
        await expectIdle(page)
    }

    const beforeResize = await drawCount(page)
    await page.setViewportSize({ width: 600, height: 900 })
    await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeResize)
    await expectIdle(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect.poll(playerTransforms).not.toEqual([])
    await expectIdle(page)

    const beforeHover = await drawCount(page)
    await page.mouse.move(641, 665)
    await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeHover)
    await expectIdle(page)
    const beforeLeave = await drawCount(page)
    await page.mouse.move(10, 80)
    await expect.poll(() => drawCount(page)).toBeGreaterThan(beforeLeave)
    await expectIdle(page)

    await page.mouse.click(641, 665)
    await expect(page.getByRole('button', { name: 'Pass', exact: true })).toBeVisible({
        timeout: 15_000
    })
    for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: 'Pass', exact: true }).click()
    }
    await expect(page.getByText('Place your cube on the board', { exact: true })).toBeVisible()
    await expect(
        page.getByText('Place your cube on the board', { exact: true }).locator('..')
    ).toHaveCSS('opacity', '1')
    await waitForFrames(page)
    await page.mouse.click(1020, 585)
    await page.mouse.move(10, 80)
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
    await expectIdle(page)

    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(
        page.getByText('Place your cube on the board', { exact: true }).locator('..')
    ).toHaveCSS('opacity', '1')
    await waitForFrames(page)
    await page.mouse.click(1020, 585)
    await page.mouse.move(10, 80)
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
    await expectIdle(page)

    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await expect(
        page.getByRole('button', { name: 'step forwards', exact: true }).locator('svg')
    ).toHaveClass(/text-white/)
    await page.getByRole('button', { name: 'step forwards', exact: true }).click()
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
    await expectIdle(page)
    await page.getByRole('button', { name: 'go to current', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Steal $1 First', exact: true })).toBeVisible()
    await expectIdle(page)

    await page.getByRole('button', { name: 'step backwards', exact: true }).click()
    await expect(
        page.getByRole('button', { name: 'step forwards', exact: true }).locator('svg')
    ).toHaveClass(/text-white/)
    await page
        .getByRole('button', { name: 'step forwards', exact: true })
        .click({ modifiers: ['Shift'] })
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
    await expectIdle(page)
    expect(errors).toEqual([])
})
