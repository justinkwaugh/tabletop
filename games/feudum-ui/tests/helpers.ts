import { expect, test, type Page } from '@playwright/test'
import type { FeudumGameSession } from '../src/lib/model/session.svelte.js'

declare global {
    interface Window {
        feudumSession: FeudumGameSession
    }
}

export const Seed = '0123456789abcdef0123456789abcdef'

/** A real hotseat session through the shared harness, its session reachable from the page. */
export async function createGame(page: Page) {
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
        await names.nth(i).fill(`Seat ${i + 1}`)
    }
    await page.getByRole('button', { name: 'Create Game', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => document.querySelector('dialog:modal') === null))
        .toBe(true)
    await expect.poll(() => page.evaluate(() => !!window.feudumSession)).toBe(true)
}

/** One seat's setup step by the session's own presses. */
async function stepSetup(page: Page, stopAtPawn: boolean): Promise<string> {
    return page.evaluate(async (stop) => {
        const session = window.feudumSession
        const goods = session.startingGoodsPanel
        if (goods?.deciding) {
            // Sulfur would ask where it goes, so these choose without it.
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
        if (drafting) {
            for (const row of drafting.cards) {
                if (!session.handPanel?.drafting?.primary.enabled && !row.picked) {
                    session.toggleHandCard(row.kind)
                }
            }
            await session.finaliseHand()
        }
        return session.gameState.machineState
    }, stopAtPawn)
}

export async function playToPawn(page: Page) {
    await expect
        .poll(() => stepSetup(page, true), { timeout: 45_000, intervals: [100] })
        .toBe('PlacingStartingPawn')
}

export async function playToCards(page: Page) {
    await expect
        .poll(() => stepSetup(page, false), { timeout: 45_000, intervals: [100] })
        .toBe('PlayingCards')
}

export async function settled(page: Page) {
    await page.waitForTimeout(300)
}

export async function shot(page: Page, name: string) {
    await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}
