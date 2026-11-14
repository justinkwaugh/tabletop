import { expect, test, type Page } from '@playwright/test'
import { createGame, playToCards, settled } from './helpers.js'

/**
 * How the table draws, by the platform's phone-rendering rules: what WebKit pays for on a phone
 * that the other specs cannot see.
 */

declare global {
    interface Window {
        feudumListenerLog: string[]
    }
}

/** Every wheel and touch listener added or removed on the page, from its first script on. */
async function logListeners(page: Page) {
    await page.addInitScript(() => {
        const watched = new Set(['wheel', 'mousewheel', 'touchstart', 'touchmove'])
        const log: string[] = []
        window.feudumListenerLog = log
        const { addEventListener, removeEventListener } = EventTarget.prototype
        EventTarget.prototype.addEventListener = function (
            this: EventTarget,
            type: string,
            ...rest: [EventListenerOrEventListenerObject | null, unknown?]
        ) {
            if (watched.has(type)) log.push(`add ${type}`)
            return addEventListener.call(this, type, ...(rest as [EventListener]))
        }
        EventTarget.prototype.removeEventListener = function (
            this: EventTarget,
            type: string,
            ...rest: [EventListenerOrEventListenerObject | null, unknown?]
        ) {
            if (watched.has(type)) log.push(`remove ${type}`)
            return removeEventListener.call(this, type, ...(rest as [EventListener]))
        }
    })
}

test('opening and closing the Key and the Supply card adds and removes no wheel or touch listener', async ({
    page
}) => {
    await logListeners(page)
    await createGame(page)
    await playToCards(page)
    await settled(page)
    await page.evaluate(() => window.feudumListenerLog.splice(0))

    await page.locator('[data-symbol-key-toggle]').click()
    await expect(page.locator('#feudum-symbol-key')).toBeVisible()
    await page.locator('[data-symbol-key-toggle]').click()
    await expect(page.locator('#feudum-symbol-key')).toHaveCount(0)
    await page.locator('[data-supply-toggle]').click()
    await expect(page.locator('#feudum-supply')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#feudum-supply')).toHaveCount(0)

    // A wheel over an open card still never zooms the board beneath it.
    await page.locator('[data-symbol-key-toggle]').click()
    const before = await page.locator('[data-board-surface]').boundingBox()
    await page.locator('#feudum-symbol-key').hover()
    await page.mouse.wheel(0, -400)
    await page.waitForTimeout(400)
    expect(await page.locator('[data-board-surface]').boundingBox()).toEqual(before)

    expect(await page.evaluate(() => window.feudumListenerLog)).toEqual([])
})
