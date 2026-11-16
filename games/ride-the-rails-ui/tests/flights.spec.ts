import { expect, test, type Page } from '@playwright/test'
import { collectPageErrors, litHex, openScenario, pressHex, settled } from './helpers.js'

// The contract's Animation plan: the board holds only the map, so the flights lift from and land
// on what the table shows beside it (the supply cube on the railroad cards, or on a phone the share
// buttons and the build panel's cards; the seat cards' share slots and money; the Transcontinental
// chip in the turn line), the round steps on the turn line's tickets at the end of a round, and the
// railroad it makes available brightens in.
collectPageErrors()

const onPhone = () => test.info().project.use.isMobile === true

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

/** The boxes on screen of what a flight lifts from or lands on, by its key. */
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

/**
 * Whether a spot is on a box, or as near it as the view allows when the box is partly or wholly
 * beyond (a phone's closed Players drawer holds the seat cards off screen).
 */
function onOrBeside(spot: Spot, box: Box, view: { width: number; height: number }): boolean {
    const near = 16
    const clamp = (value: number, size: number) => Math.min(Math.max(value, 0), size)
    const left = clamp(box.left, view.width) - near
    const right = clamp(box.right, view.width) + near
    const top = clamp(box.top, view.height) - near
    const bottom = clamp(box.bottom, view.height) + near
    return spot.x >= left && spot.x <= right && spot.y >= top && spot.y <= bottom
}

test('A share lifts from its supply cube and lands in its slot on the seat card', async ({
    page
}) => {
    await openScenario(page, 'First share')
    await settled(page)
    const [source] = await targetBoxes(page, 'supply:railroad.red')
    // Dell holds no share yet: the share fills his first slot.
    const [shares] = await targetBoxes(page, 'share-slot:p4:0')
    expect(source).toBeDefined()
    expect(shares).toBeDefined()

    await recordFlyers(page)
    await page.getByRole('button', { name: 'Take a Red share, 27 left', exact: true }).click()
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

test('A placement’s locomotive lifts from its supply cube: the card, or on a phone the build panel’s card', async ({
    page
}) => {
    await openScenario(page, 'First placement')
    await settled(page)
    const piles = await targetBoxes(page, 'supply:railroad.red')
    expect(piles).toHaveLength(1)
    const [pile] = piles
    // On a phone the one cube is the build panel's card, in the action area above the board.
    const inPanel = await page
        .locator('[data-flight-target="supply:railroad.red"]')
        .evaluate((element) => element.closest('[role="group"][aria-label="Railroads"]') !== null)
    expect(inPanel).toBe(true)
    if (onPhone()) {
        // The cards stand below the count and Skip.
        const skip = await page.getByRole('button', { name: 'Skip', exact: true }).boundingBox()
        expect(skip && pile && pile.top >= skip.y + skip.height).toBe(true)
    }

    await recordFlyers(page)
    await pressHex(page, litHex(page, 'New York: start Red'))
    await settled(page)

    const keys = await page.evaluate(() =>
        Object.keys(Reflect.get(window, 'rtrPaths') ?? {}).filter((key) =>
            key.startsWith('locomotive:')
        )
    )
    expect(keys).toHaveLength(1)
    const path = await recordedPath(page, keys[0] ?? '')
    expect(path.length).toBeGreaterThan(5)
    const first = path[0] ?? { x: -1, y: -1 }
    expect(pile && onOrBeside(first, pile, viewSize(page))).toBe(true)
})

test('The Transcontinental coin flies to the chip in the turn line, which shows the claim', async ({
    page
}) => {
    await openScenario(page, 'Transcontinental in reach')
    const chip = page.getByRole('img', { name: /^Transcontinental: / })
    await expect(chip).toHaveAccessibleName(/^Transcontinental: unclaimed/)
    const [medallion] = await targetBoxes(page, 'transcontinental')
    expect(medallion).toBeDefined()

    await recordFlyers(page)
    await pressHex(page, litHex(page, 'Denver: place Purple, $12 Transcontinental'))
    await settled(page)

    const view = viewSize(page)
    const path = await recordedPath(page, 'coin:transcontinental')
    expect(path.length).toBeGreaterThan(5)
    const last = path.at(-1) ?? { x: -1, y: -1 }
    expect(inView(last, view)).toBe(true)
    expect(medallion && onOrBeside(last, medallion, view)).toBe(true)

    // Claimed, the chip is the button that shows the line; its description says the claim.
    const claimed = page.getByRole('button', { name: 'Show the Transcontinental line' })
    await expect(claimed).toHaveAccessibleDescription('Transcontinental: claimed by Ada for $12')
    await expect(claimed).toBeInViewport()
})

test('The end of round steps the round and brightens the railroad it makes available', async ({
    page
}) => {
    await openScenario(page, 'Round one ends')
    const entries = page.getByRole('group', { name: 'Railroads' })
    await expect(entries.getByRole('button', { name: /^Orange: / })).toHaveCount(0)
    await pressHex(page, litHex(page, 'Washington: start a journey with its passenger'))
    await pressHex(page, litHex(page, 'Baltimore: link by Blue'))

    // Each frame: the current ticket and its hop (desktop), and how bright Orange's entry is.
    await page.evaluate(() => {
        const seen = { rounds: new Set<string>(), hops: 0, orange: new Set<number>() }
        const watch = () => {
            const current = document.querySelector('[role="listitem"][aria-current="step"]')
            if (current) seen.rounds.add(current.getAttribute('aria-label') ?? '')
            for (const ticket of document.querySelectorAll('[role="listitem"]')) {
                if ((ticket.getAttribute('style') ?? '').includes('scale(1.')) seen.hops++
            }
            for (const button of document.querySelectorAll('button[aria-label*="Orange"]')) {
                const slot = button.closest<HTMLElement>('[style*="opacity"], .slot')
                if (slot && slot.getBoundingClientRect().width > 0) {
                    seen.orange.add(Number(getComputedStyle(slot).opacity))
                }
            }
            Reflect.set(window, 'rtrRoundEnd', {
                rounds: [...seen.rounds],
                hops: seen.hops,
                orange: [...seen.orange]
            })
            requestAnimationFrame(watch)
        }
        watch()
    })
    await page
        .getByRole('button', { name: 'Ride', exact: true })
        .and(page.locator('button:not([data-map-ride])'))
        .click()
    await settled(page)

    const seen = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'rtrRoundEnd')))
    const { rounds, hops, orange }: { rounds: string[]; hops: number; orange: number[] } =
        JSON.parse(seen)
    if (!onPhone()) {
        expect(rounds).toEqual(['Round 1, Red and Blue arrive', 'Round 2, Orange arrives'])
        expect(hops).toBeGreaterThan(2)
    }
    // Orange's card joins unseen and brightens through the values between. A phone has no cards:
    // Orange is among the next seat's share buttons once the round has stepped.
    if (!onPhone()) {
        expect(orange).toContain(0)
        expect(orange.some((opacity) => opacity > 0.3 && opacity < 0.95)).toBe(true)
    }
    // Ada takes a share next: Orange's card (on a phone, among the panel's buttons) is a share
    // button.
    await expect(
        entries.getByRole('button', { name: 'Take an Orange share, 27 left', exact: true })
    ).toBeVisible()
})
