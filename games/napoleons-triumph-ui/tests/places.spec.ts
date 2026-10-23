import { expect, test, type Locator, type Page } from '@playwright/test'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import {
    createGame,
    deployBothArmies,
    failOnPageErrors,
    moveCorps,
    openMapMenu,
    pickUp,
    rearrange,
    tap
} from './table.js'

failOnPageErrors()

const FADE = 2400

async function threatenFrom72Into81(page: Page) {
    await createGame(page)
    await deployBothArmies(page)
    await page.getByRole('button', { name: 'End turn' }).click()
    await expect(page.getByText('French turn')).toBeVisible()
    await rearrange(page, (state) => moveCorps(state, 'langeron', { locale: 81 }))
    await pickUp(page, 'vandamme')
    await tap(page, '[data-aim-locale="81"]')
}

async function onScreen(page: Page, shape: Locator): Promise<boolean> {
    const at = (await shape.boundingBox())!
    const view = (await page.locator('.nt-board-host').boundingBox())!
    return (
        at.x >= view.x &&
        at.x + at.width <= view.x + view.width &&
        at.y >= view.y &&
        at.y + at.height <= view.y + view.height
    )
}

test('a place named in the text shows its locale on the map, highlighted for a moment', async ({
    page
}) => {
    await threatenFrom72Into81(page)
    const highlight = page.locator('[data-located-locale]')
    await page.locator('.nt-orders-name').getByRole('button', { name: 'locale 81' }).click()
    await expect(page.locator('[data-located-locale="81"]')).toHaveCount(1)
    await expect(highlight).toHaveCount(0, { timeout: FADE * 2 })

    await tap(page, `svg [data-threat="${AUSTERLITZ.approachBetween(72, 81).id}"]`)
    const title = page.locator('.nt-battle-title')
    await expect(title).toContainText('Attack from locale 72 into locale 81')
    await title.getByRole('button', { name: 'locale 72' }).click()
    await expect(page.locator('[data-located-locale="72"]')).toHaveCount(1)
    await title.getByRole('button', { name: 'locale 81' }).click()
    await expect(page.locator('[data-located-locale="81"]')).toHaveCount(1)
    await expect(highlight).toHaveCount(1)
})

test('pressing a place again starts its highlight again', async ({ page }) => {
    await threatenFrom72Into81(page)
    const place = page.locator('.nt-orders-name').getByRole('button', { name: 'locale 81' })
    const highlight = page.locator('[data-located-locale="81"]')
    await place.click()
    await page.waitForTimeout(FADE * 0.6)
    await place.click()
    await page.waitForTimeout(FADE * 0.6)
    await expect(highlight).toHaveCount(1)
    await expect(highlight).toHaveCount(0, { timeout: FADE * 2 })
})

test('the view moves for a place only when its locale is off screen', async ({ page }) => {
    await threatenFrom72Into81(page)
    const place = page.locator('.nt-orders-name').getByRole('button', { name: 'locale 81' })
    const board = page.locator('svg[data-board]')
    await openMapMenu(page)
    await page.getByRole('button', { name: 'Locale numbers' }).click()
    const number = page.locator('[data-locale-number="81"]')

    // The view is still moving to the corps just picked up.
    await page.waitForTimeout(1200)
    expect(await onScreen(page, number)).toBe(true)
    const before = await board.boundingBox()
    await place.click()
    await page.waitForTimeout(800)
    expect(await board.boundingBox()).toEqual(before)

    for (let press = 0; press < 8 && (await onScreen(page, number)); press++) {
        await page.getByRole('button', { name: 'Zoom in' }).click()
        await page.waitForTimeout(500)
    }
    expect(await onScreen(page, number)).toBe(false)
    const zoomed = (await board.boundingBox())!
    await place.click()
    await page.waitForTimeout(1200)
    expect(await onScreen(page, page.locator('[data-located-locale="81"]'))).toBe(true)
    expect((await board.boundingBox())!.width).toBeCloseTo(zoomed.width, 0)
})

test('a corps’s location in the armies panel highlights its locale without zooming in', async ({
    page
}) => {
    await threatenFrom72Into81(page)
    await page.waitForTimeout(1200)
    const board = page.locator('svg[data-board]')
    const before = (await board.boundingBox())!
    await page.getByRole('tab', { name: /Armies/ }).click()
    await page.getByRole('button', { name: 'Show Kienmayer on the map' }).click()
    await expect(page.locator('[data-located-locale]')).toHaveCount(1)
    await page.waitForTimeout(1200)
    expect((await board.boundingBox())!.width).toBeCloseTo(before.width, 0)
})
