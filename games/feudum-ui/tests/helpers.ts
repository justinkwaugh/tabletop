import { expect, test, type Page } from '@playwright/test'
import type { FeudumGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        feudumSession: FeudumGameSession
    }
}

export const Seed = '0123456789abcdef0123456789abcdef'

/**
 * A real hotseat session through the shared harness, its session reachable from the page. The seats
 * after the first are named by `nameOf`, from seat 2.
 */
export async function createGame(page: Page, nameOf = (seat: number) => `Seat ${seat}`) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        expect(body).toContain('return getContext();')
        await route.fulfill({
            response,
            body: body.replace(
                'return getContext();',
                'return window.feudumSession = getContext();'
            )
        })
    })
    await page.goto('/')
    await expect(async () => {
        await page.getByRole('button', { name: 'New game', exact: true }).click()
        await expect(page.getByPlaceholder('choose a name for your game')).toBeVisible({
            timeout: 1_000
        })
    }).toPass({ timeout: 45_000 })
    await page.getByPlaceholder('choose a name for your game').fill('Feudum')
    await page.getByPlaceholder('optional reproduction seed').fill(Seed)
    const names = page.getByPlaceholder('player name')
    for (let i = 1; i < (await names.count()); i++) {
        await names.nth(i).fill(nameOf(i + 1))
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => document.querySelector('dialog:modal') === null))
        .toBe(true)
    await expect.poll(() => page.evaluate(() => !!window.feudumSession)).toBe(true)
}

/** One seat's setup step by the session's own presses. */
async function stepSetup(page: Page, stopAtPawn: boolean, stopAtHands = false): Promise<string> {
    return page.evaluate(
        async ([stop, stopHands]) => {
            const session = window.feudumSession
            const goods = session.startingGoodsPanel
            if (goods?.deciding) {
                for (const good of ['iron', 'wood', 'saltpeter', 'food'] as const) {
                    if (!session.startingGoodsPanel?.primary) {
                        session.pressStartingGood(good)
                    }
                }
                await session.sendStartingGoods()
                return session.gameState.machineState
            }
            const pawn = session.startingPawnPanel
            if (pawn?.deciding && !stop) {
                const [first] = pawn.characters
                const space = [...session.boardOffer.targets.keys()].find((target) =>
                    target.startsWith('space:')
                )
                if (first && space) {
                    await session.pressStartingCharacter(first.character)
                    await session.pressBoardTarget(space)
                    if (session.startingPawnPanel?.deciding) {
                        await session.sendStartingPawn()
                    }
                }
                return session.gameState.machineState
            }
            const drafting = session.handPanel?.drafting
            if (drafting && !stopHands) {
                for (const row of drafting.cards) {
                    if (!session.handPanel?.drafting?.primary.enabled && !row.picked) {
                        session.toggleHandCard(row.kind)
                    }
                }
                await session.finaliseHand()
            }
            return session.gameState.machineState
        },
        [stopAtPawn, stopAtHands] as const
    )
}

export async function playToPawn(page: Page) {
    await expect
        .poll(() => stepSetup(page, true), { timeout: 45_000, intervals: [100] })
        .toBe('PlacingStartingPawn')
}

export async function playToHands(page: Page) {
    await expect
        .poll(() => stepSetup(page, false, true), { timeout: 45_000, intervals: [100] })
        .toBe('SelectingHands')
}

export async function playToCards(page: Page) {
    await expect
        .poll(() => stepSetup(page, false), { timeout: 45_000, intervals: [100] })
        .toBe('PlayingCards')
}

export async function settled(page: Page) {
    await page.waitForTimeout(300)
    // An Action's motion holds the table for as long as it plays.
    await page.waitForFunction(() => !window.feudumSession?.updatingVisibleState)
}

export async function shot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}

/**
 * The score track's spaces the zoom row stands over: Key, Supply and the zoom buttons against every
 * space shown in the board's view, each as "space N under ‹what›". Contract, Symbol key and Supply.
 */
export async function scoreSpacesCovered(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const view = document.querySelector('[data-board-view]')?.getBoundingClientRect()
        const row: [string, Element | null | undefined][] = [
            ['Key', document.querySelector('[data-symbol-key-toggle]')],
            ['Supply', document.querySelector('[data-supply-toggle]')],
            ['zoom', document.querySelector('button[aria-label="Zoom in"]')?.parentElement]
        ]
        const covered: string[] = []
        for (const space of document.querySelectorAll('[data-score-space]')) {
            const box = space.getBoundingClientRect()
            const shown =
                view !== undefined &&
                box.right > view.left &&
                box.left < view.right &&
                box.bottom > view.top &&
                box.top < view.bottom
            for (const [name, element] of row) {
                const over = element?.getBoundingClientRect()
                if (
                    shown &&
                    over &&
                    over.right > box.left + 1 &&
                    over.left < box.right - 1 &&
                    over.bottom > box.top + 1 &&
                    over.top < box.bottom - 1
                ) {
                    covered.push(`space ${space.getAttribute('data-score-space')} under ${name}`)
                }
            }
        }
        return covered
    })
}

/** Zooms in `zooms` presses, then drags the board as far as it goes toward its lower-left corner. */
export async function zoomToLowerLeft(page: Page, zooms: number) {
    for (let press = 0; press < zooms; press += 1) {
        await page.getByRole('button', { name: 'Zoom in' }).click()
        await page.waitForTimeout(250)
    }
    const view = await page.locator('[data-board-view]').boundingBox()
    if (!view) {
        throw new Error('no board view')
    }
    const from = { x: view.x + view.width * 0.3, y: view.y + view.height * 0.6 }
    for (let drag = 0; drag < 4; drag += 1) {
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        await page.mouse.move(from.x + view.width * 0.6, from.y - view.height * 0.5, { steps: 8 })
        await page.mouse.up()
    }
    await page.waitForTimeout(400)
}
