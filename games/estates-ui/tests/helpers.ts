import type { Object3D, Scene } from 'three'
import type { EstatesGameSession } from '../src/lib/model/EstatesGameSession.svelte'
import { expect, type Page } from '@playwright/test'

export async function drawCount(page: Page) {
    return page.evaluate(() => Number(document.documentElement.dataset.draws ?? 0))
}

export async function waitForFrames(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                let frames = 0
                function sample() {
                    if (++frames === 10) resolve()
                    else requestAnimationFrame(sample)
                }
                requestAnimationFrame(sample)
            })
    )
}

export async function expectIdle(page: Page) {
    await expect
        .poll(
            async () => {
                const before = await drawCount(page)
                await waitForFrames(page)
                return (await drawCount(page)) - before
            },
            { timeout: 15_000, message: 'The settled board must stop drawing' }
        )
        .toBe(0)
}

export async function createGame(page: Page, name = 'Render check', hiddenMoney = false) {
    await page.goto('/')
    await page.getByRole('button', { name: 'New game', exact: true }).click()
    await page.getByPlaceholder('choose a name for your game').fill(name)
    await page
        .getByPlaceholder('optional reproduction seed')
        .fill('0123456789abcdef0123456789abcdef')
    if (hiddenMoney) {
        await page
            .locator('label')
            .filter({ has: page.locator('#hiddenMoney') })
            .click()
        await expect(page.locator('#hiddenMoney')).toBeChecked()
    }
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) {
        await names.nth(i).fill(`Player ${i + 1}`)
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect(page.getByText('Choose a piece to auction', { exact: true })).toBeVisible()
}

declare global {
    interface Window {
        estatesSession: EstatesGameSession
        estatesScene: Scene
        estatesPreview: Object3D
        estatesPreviewAnimating: () => boolean
    }
}

export async function inspectScene(page: Page) {
    for (const [url, original, replacement] of [
        [
            '**/gameSessionContext.svelte.ts*',
            'return getContext();',
            'return window.estatesSession = getContext();'
        ],
        [
            '**/Scene.svelte*',
            'let cameraControls;',
            'window.estatesScene = scene; let cameraControls;'
        ],
        [
            '**/AuctionPreview.svelte*',
            '$.set(group, ref, true);',
            'window.estatesPreview = ref; window.estatesPreviewAnimating = () => ref.position.y < 0; $.set(group, ref, true);'
        ]
    ]) {
        await page.route(url, async (route) => {
            const response = await route.fetch()
            const body = await response.text()
            expect(body).toContain(original)
            await route.fulfill({ response, body: body.replace(original, () => replacement) })
        })
    }
}
