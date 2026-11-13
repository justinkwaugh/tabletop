import { expect, test, type Page } from '@playwright/test'
import type { DickeKartoffelnGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        dkSession: DickeKartoffelnGameSession
    }
}

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function createGame(page: Page) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.dkSession = getContext();')
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Dicke Kartoffeln')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Farmer ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.dkSession)).toBe(true)
}

function round(page: Page) {
    return page.evaluate(
        () => `${window.dkSession.year}-${window.dkSession.gameState.machineState}`
    )
}

async function screenshot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

// Hotseat: whoever is still deciding acts, until the round moves on.
async function everyone(page: Page, act: () => Promise<void>) {
    const start = await round(page)
    for (let step = 0; step < 8 && (await round(page)) === start; step++) {
        await act()
        await page.getByRole('button', { name: /^(Seal my plan|Do nothing this round)$/ }).click()
        await page.waitForTimeout(150)
    }
    expect(await round(page)).not.toBe(start)
}

test('plays a farming year through the farm and the yield sheet', async ({ page }) => {
    await createGame(page)
    await expect(page.getByText('Taking compost').first()).toBeVisible()
    await screenshot(page, '01-compost')

    await page.getByRole('button', { name: 'Field 1' }).click()
    await expect(page.getByRole('button', { name: 'Seal my plan' })).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Do nothing this round' })).toBeVisible()
    await everyone(page, async () => {})

    await everyone(page, async () => {
        await page.getByRole('button', { name: 'Field 1' }).click()
        await page.getByRole('button', { name: 'Field 2' }).click()
    })
    expect(await round(page)).toBe('1-Sowing')
    await expect(page.getByRole('tab', { name: 'Yield sheet', selected: true })).toBeVisible()
    await everyone(page, async () => {
        await page.getByRole('button', { name: 'Amalie on field 1' }).first().click()
        await page.getByRole('button', { name: 'Chris on field 2' }).first().click()
    })
    await screenshot(page, '02-sown')

    await everyone(page, async () => {
        await page.getByRole('button', { name: 'Fertilize field 1' }).first().click()
    })
    await everyone(page, async () => {})

    expect(await round(page)).toBe('1-RegisteringSales')
    await screenshot(page, '03-harvest')
    await everyone(page, async () => {
        const more = page.getByRole('button', { name: 'One sack more' })
        for (let i = 0; i < (await more.count()); i++) {
            if (await more.nth(i).isEnabled()) await more.nth(i).click()
        }
    })
    await expect.poll(() => round(page)).toBe('2-TakingCompost')
    await page.getByRole('tab', { name: 'Yield sheet' }).click()
    await expect(page.locator('.sum').first()).toBeVisible()
    await screenshot(page, '04-year-two')
})

test('the seed picker opens beside its field where getBoundingClientRect leaves out CSS zoom', async ({
    page
}) => {
    // Safari 26.0 and older report a rect inside a CSS-zoomed element divided by its zoom.
    await page.addInitScript(() => {
        const measure = Element.prototype.getBoundingClientRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
            let zoom = Number.parseFloat(getComputedStyle(this).zoom) || 1
            for (let node = this.parentElement; node; node = node.parentElement)
                zoom *= Number.parseFloat(getComputedStyle(node).zoom) || 1
            const rect = measure.call(this)
            return new DOMRect(rect.x / zoom, rect.y / zoom, rect.width / zoom, rect.height / zoom)
        }
    })
    await createGame(page)
    await everyone(page, async () => {})
    await everyone(page, async () => {
        await page.getByRole('button', { name: 'Field 1' }).click()
        await page.getByRole('button', { name: 'Field 2' }).click()
    })
    await page.evaluate(() => window.dkSession.showMyFarm())
    const field = page.locator(
        `#dk-field-1-${await page.evaluate(() => window.dkSession.myPlayerId)}`
    )
    const boardZoom = await field.evaluate((element) => {
        const zoomed = element.closest<HTMLElement>('[style*="zoom"]')
        return zoomed ? Number.parseFloat(getComputedStyle(zoomed).zoom) : 1
    })
    expect(boardZoom).toBeLessThan(0.9)
    await page.evaluate(() => window.dkSession.clickField(1))
    await expect(page.locator('.picker')).toBeVisible()
    // The fake patches only getBoundingClientRect, so getClientRects gives the rect as drawn.
    await expect
        .poll(() =>
            field.evaluate((element) => {
                const drawn = element.getClientRects()[0]
                const picker = document.querySelector('.picker')?.getClientRects()[0]
                if (!drawn || !picker) throw new Error('Missing field or picker')
                const across = Math.max(drawn.left - picker.right, picker.left - drawn.right)
                const down = Math.max(drawn.top - picker.bottom, picker.top - drawn.bottom)
                return Math.max(across, down)
            })
        )
        .toBeLessThan(12)
})
