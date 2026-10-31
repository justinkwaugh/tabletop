import { expect, test, type Page } from '@playwright/test'
import type { PromontoryPointGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        promontoryPointSession: PromontoryPointGameSession
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
            body: body.replace(
                'return getContext();',
                'return window.promontoryPointSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill('Session')
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) await names.nth(i).fill(`Player ${i + 1}`)
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.promontoryPointSession)).toBe(true)
}

test('O-2, R-3.3: a picked piece lights its hexes in the dev harness, and a second press unpicks it', async ({
    page
}) => {
    await createGame(page)
    const picked = await page.evaluate(() => {
        const session = window.promontoryPointSession
        session.pressPiece(session.pickablePieces[0])
        return { pick: session.piecePick, lit: session.boardOffer.lit.length }
    })
    expect(picked.pick?.source).toBe('manual')
    expect(picked.lit).toBeGreaterThan(0)

    const unpicked = await page.evaluate(() => {
        const session = window.promontoryPointSession
        session.pressPiece(session.pickablePieces[0])
        return { pick: session.piecePick ?? null, lit: session.boardOffer.lit.length }
    })
    expect(unpicked).toEqual({ pick: null, lit: 0 })
})
