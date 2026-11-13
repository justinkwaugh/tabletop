import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, litHex, openScenario, pressHex, settled } from './helpers.js'

// The contract's Phone layout and Animation plan: phones leave the board's margin out, so the
// flights lift from and land on what the phone shows (the railroad strip above the board, the seat
// cards' shares and money), the strip's round badge steps at the end of a round, and the claimed
// Transcontinental shows on the strip.
collectPageErrors()

test.beforeEach(() => {
    test.skip(test.info().project.use.isMobile !== true, 'The margin shows these on wider screens.')
})

type Spot = { x: number; y: number }
type Box = { left: number; top: number; right: number; bottom: number }

/** Starts recording, each frame, the screen centre of every visible flyer, by its key. */
function recordFlyers(page: Page): Promise<void> {
    return page.evaluate(() => {
        const paths: Record<string, Spot[]> = {}
        Reflect.set(window, 'rtrPaths', paths)
        const watch = () => {
            for (const flyer of document.querySelectorAll<SVGGElement>('[data-flyer]')) {
                const key = flyer.dataset.flyer ?? ''
                const box = flyer.getBoundingClientRect()
                if (Number(flyer.getAttribute('opacity') ?? '1') < 0.5 || box.width === 0) continue
                const path = (paths[key] ??= [])
                path.push({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
            }
            requestAnimationFrame(watch)
        }
        watch()
    })
}

async function recordedPath(page: Page, key: string): Promise<Spot[]> {
    const paths = await page.evaluate(() => {
        const recorded: unknown = Reflect.get(window, 'rtrPaths')
        return JSON.stringify(recorded ?? {})
    })
    const all: Record<string, Spot[]> = JSON.parse(paths)
    return all[key] ?? []
}

/** The boxes on screen of what a phone flight lifts from or lands on, by its key. */
function targetBoxes(page: Page, key: string): Promise<Box[]> {
    return page.evaluate(
        (target) =>
            [...document.querySelectorAll(`[data-flight-target="${target}"]`)].map((element) => {
                const { left, top, right, bottom } = element.getBoundingClientRect()
                return { left, top, right, bottom }
            }),
        key
    )
}

function viewSize(page: Page): { width: number; height: number } {
    const size = page.viewportSize()
    expect(size).not.toBeNull()
    return size ?? { width: 0, height: 0 }
}

function inView(spot: Spot, view: { width: number; height: number }): boolean {
    return spot.x >= 0 && spot.y >= 0 && spot.x <= view.width && spot.y <= view.height
}

/** Whether a spot is on a box, or as near it as the view allows when the box is partly beyond. */
function onOrBeside(spot: Spot, box: Box, view: { width: number; height: number }): boolean {
    const near = 16
    const left = Math.max(box.left, 0) - near
    const right = Math.min(box.right, view.width) + near
    const top = Math.max(box.top, 0) - near
    const bottom = Math.min(box.bottom, view.height) + near
    return spot.x >= left && spot.x <= right && spot.y >= top && spot.y <= bottom
}

test('On a phone a share lifts from the strip above the board and lands on the seat card', async ({
    page
}) => {
    await openScenario(page, 'First share')
    await settled(page)
    const red = await page.evaluate(() => {
        const icon = [...document.querySelectorAll('[data-flight-target^="supply:"]')].find(
            (element) => element.closest('button')?.getAttribute('aria-label')?.startsWith('Red:')
        )
        return icon?.getAttribute('data-flight-target') ?? ''
    })
    expect(red).not.toBe('')
    const [source] = await targetBoxes(page, red)
    const [shares] = await targetBoxes(page, 'seat:p4')
    expect(source).toBeDefined()
    expect(shares).toBeDefined()

    await recordFlyers(page)
    await page.getByRole('button', { name: 'Red, 27 left', exact: true }).click()
    await settled(page)

    const path = await recordedPath(page, 'share')
    expect(path.length).toBeGreaterThan(5)
    const view = viewSize(page)
    const first = path[0] ?? { x: -1, y: -1 }
    const last = path.at(-1) ?? { x: -1, y: -1 }
    expect(source && onOrBeside(first, source, view)).toBe(true)
    expect(inView(last, view)).toBe(true)
    expect(shares && onOrBeside(last, shares, view)).toBe(true)
    expect(path.every((spot) => inView(spot, view))).toBe(true)
})

test('On a phone the Transcontinental coin lands on the money, and the strip shows the claim', async ({
    page
}) => {
    await openScenario(page, 'Transcontinental in reach')
    const medallion = page.getByRole('img', { name: /^Transcontinental: claimed by / })
    await expect(medallion).toHaveCount(0)

    await recordFlyers(page)
    await pressHex(page, litHex(page, 'Denver: place Purple, $12 Transcontinental'))
    await settled(page)

    const view = viewSize(page)
    const path = await recordedPath(page, 'coin:transcontinental')
    expect(path.length).toBeGreaterThan(5)
    const last = path.at(-1) ?? { x: -1, y: -1 }
    expect(inView(last, view)).toBe(true)
    const money = await targetBoxes(page, 'money:p1')
    expect(money.some((box) => onOrBeside(last, box, view))).toBe(true)

    await expect(medallion).toHaveAccessibleName('Transcontinental: claimed by Ada for $12')
    await expect(medallion).toBeInViewport()
})

test('On a phone the end of round steps the strip badge and brightens the new railroad', async ({
    page
}) => {
    await openScenario(page, 'Round one ends')
    const badge = page.getByLabel('Round 1', { exact: true })
    await expect(badge).toBeVisible()
    await pressHex(page, litHex(page, 'Washington: start a journey with its passenger'))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))

    // Each frame: the badge's round and hop, and how bright Orange's entry is.
    await page.evaluate(() => {
        const seen = { rounds: new Set<string>(), hops: 0, orange: new Set<number>() }
        const watch = () => {
            const round = document.querySelector('.phone-strip .round')
            if (round) {
                seen.rounds.add(round.getAttribute('aria-label') ?? '')
                if ((round.getAttribute('style') ?? '').includes('scale(1.')) seen.hops++
            }
            const orange = document
                .querySelector('.phone-strip button[aria-label^="Orange:"]')
                ?.closest<HTMLElement>('.slot')
            if (orange) seen.orange.add(Number(getComputedStyle(orange).opacity))
            Reflect.set(window, 'rtrRoundEnd', {
                rounds: [...seen.rounds],
                hops: seen.hops,
                orange: [...seen.orange]
            })
            requestAnimationFrame(watch)
        }
        watch()
    })
    await page.getByRole('button', { name: 'Ride · you +$3', exact: true }).click()
    await settled(page)

    const seen = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'rtrRoundEnd')))
    const { rounds, hops, orange }: { rounds: string[]; hops: number; orange: number[] } =
        JSON.parse(seen)
    expect(rounds).toEqual(['Round 1', 'Round 2'])
    expect(hops).toBeGreaterThan(2)
    // Orange's entry brightens through the values between dim and full.
    expect(orange.some((opacity) => opacity > 0.5 && opacity < 0.95)).toBe(true)
    await expect(page.getByLabel('Round 2', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Orange: 27 left/ })).toBeVisible()
})
