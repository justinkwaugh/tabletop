import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import type { Game } from '@tabletop/common'
import type { FinanceExampleState } from '@tabletop/18xx'

const api = process.env.HOSTED_API_URL ?? 'http://localhost:3100'
const prefix = process.env.HOSTED_TEST_USER_PREFIX ?? 's20-'
const password = process.env.HOSTED_TEST_PASSWORD ?? 'local-18xx-verification'
const names = ['alex', 'blair', 'casey', 'drew']
const titles = [
    { id: 'the-old-prince', name: 'The Old Prince 1871' },
    { id: 'shikoku-1889', name: 'Shikoku 1889' }
]

async function accounts(browser: Browser) {
    const contexts = new Map<string, BrowserContext>()
    for (const name of names) {
        const context = await browser.newContext({
            baseURL: process.env.HOSTED_SITE_URL ?? 'http://localhost:5174',
            viewport: { width: 1400, height: 1000 }
        })
        const response = await context.request.post(`${api}/api/v1/auth/login`, {
            data: { username: prefix + name, password }
        })
        expect(response.ok(), await response.text()).toBe(true)
        const { payload } = await response.json()
        contexts.set(payload.user.id, context)
    }
    return contexts
}

async function snapshot(
    context: BrowserContext,
    gameId: string
): Promise<Game & { state: FinanceExampleState }> {
    const response = await context.request.get(`${api}/api/v1/game/get/${gameId}`)
    expect(response.ok(), await response.text()).toBe(true)
    return (await response.json()).payload.game
}

async function createGame(page: Page, title: (typeof titles)[number], position: string) {
    const name = `18xx verification ${title.id} ${position} ${Date.now()}`
    await page.route(`**/game/${title.id}/create`, async (route) => {
        const body = route.request().postDataJSON()
        body.game.config = { examplePosition: position }
        await route.continue({ postData: JSON.stringify(body) })
    })
    await page.goto('/library')
    await page.getByText(title.name, { exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill(name)
    await page.getByRole('dialog').getByText('4', { exact: true }).click()
    for (let i = 1; i < names.length; i++) {
        await page
            .getByPlaceholder('player name')
            .nth(i)
            .fill(prefix + names[i].slice(0, 2))
        await page.getByText(prefix + names[i], { exact: true }).click()
    }
    const created = page.waitForResponse((response) =>
        response.url().endsWith(`/${title.id}/create`)
    )
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    const response = await created
    expect(response.ok(), await response.text()).toBe(true)
    const game: Game = (await response.json()).payload.game
    return game
}

async function startGame(page: Page, game: Game, contexts: Map<string, BrowserContext>) {
    for (const [userId, context] of contexts) {
        if (userId === game.ownerId) continue
        const guest = await context.newPage()
        await guest.goto('/dashboard')
        await guest
            .locator('.border-4')
            .filter({ hasText: game.name })
            .getByRole('button', { name: 'Join', exact: true })
            .click()
        await guest.close()
    }
    await page.goto('/dashboard')
    await page
        .locator('.border-4')
        .filter({ hasText: game.name })
        .getByRole('button', { name: 'Start', exact: true })
        .click()
    await page.waitForURL(`**/game/${game.id}`)
}

async function openGame(browser: Browser, title: (typeof titles)[number], position: string) {
    const contexts = await accounts(browser)
    const host = contexts.values().next().value!
    try {
        const page = await host.newPage()
        const created = await createGame(page, title, position)
        await startGame(page, created, contexts)
        const initial = await snapshot(host, created.id)
        const actor = initial.players.find(
            (player) => player.id === initial.state!.activePlayerIds[0]
        )!
        const buyerContext = contexts.get(actor.userId!)!
        const buyer = buyerContext === host ? page : await buyerContext.newPage()
        if (buyer !== page) {
            await buyer.goto(`/game/${created.id}`)
            await page.close()
        }
        return { contexts, host, created, initial, actor, buyerContext, buyer }
    } catch (error) {
        for (const context of contexts.values()) await context.close()
        throw error
    }
}

for (const title of titles) {
    test(`${title.name} reconciles a purchase between separate clients and restores its obligation after reconnect`, async ({
        browser
    }) => {
        const { contexts, host, created, initial, actor, buyerContext, buyer } = await openGame(
            browser,
            title,
            'transfers'
        )
        try {
            const panel = buyer.getByRole('region', { name: 'Company decisions', exact: true })
            await panel.getByLabel('Purchase asset').selectOption('0')
            await panel.getByLabel('Offer price').fill('17')
            const submitted = buyer.waitForResponse((response) =>
                response.url().endsWith('/action/OfferPurchase')
            )
            await panel.getByRole('button', { name: 'Confirm decision', exact: true }).click()
            const submission = await submitted
            expect(submission.ok(), await submission.text()).toBe(true)
            await expect(panel.getByLabel('Purchase response')).toContainText('offers 17')
            const pending = await snapshot(host, created.id)
            const offer = pending.state!.purchaseOffer!
            const seller = pending.players.find((player) => player.id === offer.sellerPlayerId)!
            expect(seller.userId).not.toBe(actor.userId)
            await expect(
                panel.getByRole('button', { name: 'Accept purchase', exact: true })
            ).toBeDisabled()
            const forbidden = await buyerContext.request.post(
                `${api}/api/v1/game/${title.id}/action/RespondToPurchaseOffer`,
                {
                    data: {
                        action: {
                            id: crypto.randomUUID(),
                            gameId: created.id,
                            source: 'user',
                            type: 'RespondToPurchaseOffer',
                            playerId: seller.id,
                            offerId: offer.id,
                            accept: true
                        }
                    }
                }
            )
            expect(forbidden.ok()).toBe(false)
            expect((await forbidden.json()).error.name).toBe('UserIsNotAllowedPlayerError')
            expect((await snapshot(host, created.id)).state!.purchaseOffer).toEqual(offer)
            const sellerContext = contexts.get(seller.userId!)!
            let sellerPage = await sellerContext.newPage()
            await sellerPage.goto(`/game/${created.id}`)
            await expect(
                sellerPage.getByRole('button', { name: 'Accept purchase', exact: true })
            ).toBeEnabled()
            await sellerPage.close()
            sellerPage = await sellerContext.newPage()
            await sellerPage.goto(`/game/${created.id}`)
            const responseReceived = sellerPage.waitForResponse((response) =>
                response.url().endsWith('/action/RespondToPurchaseOffer')
            )
            await sellerPage.getByRole('button', { name: 'Accept purchase', exact: true }).click()
            const response = await responseReceived
            expect(response.ok(), await response.text()).toBe(true)
            await expect(panel.getByLabel('Purchase response')).toHaveCount(0)
            const accepted = await snapshot(host, created.id)
            expect(accepted.state!.purchaseOffer).toBeUndefined()
            expect(accepted.state!.activePlayerIds).toEqual(initial.state!.activePlayerIds)
            await buyer.reload()
            await expect(buyer.getByLabel('Purchase response')).toHaveCount(0)
            expect((await snapshot(sellerContext, created.id)).state).toEqual(accepted.state)
        } finally {
            for (const context of contexts.values()) await context.close()
        }
    })
}

test('1889 reconnects Ehime’s seller during the extra tile lay and returns control to the company', async ({
    browser
}) => {
    const title = titles[1]
    const { contexts, host, created, initial, buyer } = await openGame(browser, title, 'powers')
    try {
        const panel = buyer.getByRole('region', { name: 'Company decisions', exact: true })
        const choice = await panel
            .getByLabel('Purchase asset')
            .locator('option')
            .filter({ hasText: 'ER ·' })
            .getAttribute('value')
        expect(choice).not.toBeNull()
        await panel.getByLabel('Purchase asset').selectOption(choice!)
        const offered = buyer.waitForResponse((response) =>
            response.url().endsWith('/action/OfferPurchase')
        )
        await panel.getByRole('button', { name: 'Confirm decision', exact: true }).click()
        expect((await offered).ok()).toBe(true)
        const pending = await snapshot(host, created.id)
        const seller = pending.players.find(
            (player) => player.id === pending.state!.purchaseOffer!.sellerPlayerId
        )!
        const sellerContext = contexts.get(seller.userId!)!
        let page = await sellerContext.newPage()
        await page.goto(`/game/${created.id}`)
        const accepted = page.waitForResponse((response) =>
            response.url().endsWith('/action/RespondToPurchaseOffer')
        )
        await page.getByRole('button', { name: 'Accept purchase', exact: true }).click()
        expect((await accepted).ok()).toBe(true)
        await expect(page.getByRole('button', { name: 'Decline private tile lay' })).toBeEnabled()
        await page.close()
        page = await sellerContext.newPage()
        await page.goto(`/game/${created.id}`)
        const power = page.getByRole('region', { name: 'Company decisions', exact: true })
        await power.getByLabel('Private tile lay', { exact: true }).selectOption('0')
        const placed = page.waitForResponse((response) =>
            response.url().endsWith('/action/LayPrivateTile')
        )
        await power.getByRole('button', { name: 'Confirm decision', exact: true }).click()
        expect((await placed).ok()).toBe(true)
        const result = await snapshot(host, created.id)
        expect(result.state!.privateTrackLay).toBeUndefined()
        expect(result.state!.trackStep!.lays).toEqual(initial.state!.trackStep!.lays)
        expect(result.state!.activePlayerIds).toEqual(initial.state!.activePlayerIds)
        await expect(buyer.getByRole('button', { name: 'Finish track', exact: true })).toBeEnabled()
    } finally {
        for (const context of contexts.values()) await context.close()
    }
})
