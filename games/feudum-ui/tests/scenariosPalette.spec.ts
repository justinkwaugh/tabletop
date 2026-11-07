import { expect } from '@playwright/test'
import { Routes, ScoreTrack, Spaces } from '@tabletop/feudum'
import { scenario, type ScenarioTable } from './scenarioTable.js'

/**
 * The contract's Palette and Geometry scenarios S71 and S72, on the drawn table at both widths. The
 * unit specs prove the tokens and the positions; these prove what reaches the page.
 */

const Desert5 = 'space:space.desert.5'

const attributes = (table: ScenarioTable, selector: string, name: string) =>
    table.page
        .locator(selector)
        .evaluateAll((all, attribute) => all.map((one) => one.getAttribute(attribute) ?? ''), name)

scenario(
    'S71 R-4.2.3 Palette: every chip on the board carries its label over the halo',
    'move-ferry',
    async (table) => {
        await table.press(table.card('Move'))
        await expect(table.pick(Desert5).locator('[data-chip="rose"]')).toHaveText('ferry · 2s')
        const chips = await table.page
            .locator('[data-board-surface] [data-chip]')
            .evaluateAll((all) =>
                all.map((chip) => ({
                    tone: chip.getAttribute('data-chip'),
                    label: (chip.textContent ?? '').trim(),
                    stroke: chip.querySelector('rect')?.getAttribute('stroke') ?? 'none'
                }))
            )
        expect(chips.some(({ tone }) => tone === 'rose')).toBe(true)
        for (const chip of chips) {
            expect(chip.label).not.toBe('')
            expect(chip.stroke).toBe('var(--feudum-halo)')
        }
    }
)

scenario(
    'S71 R-5-H1 Palette: a seal keeps its crown and never a halo, on the board and in a panel',
    'seals-noble-push',
    async (table) => {
        const seals = table.page.locator('[data-board-surface] [data-motion^="seal:"]')
        await expect(seals).toHaveCount(3)
        const panel = await table.seatPanel('p2')
        const held = panel.locator('[data-seals]')
        await expect(held.getByRole('img', { name: "king's seal" })).toHaveCount(1)
        for (const seal of [...(await seals.all()), held]) {
            const { markup, chips, ringed } = await seal.evaluate((element) => ({
                markup: element.outerHTML,
                chips: element.querySelectorAll('[data-chip]').length,
                ringed: [...element.querySelectorAll('*')].some((one) =>
                    getComputedStyle(one).boxShadow.includes('var(--feudum-halo)')
                )
            }))
            expect(markup).not.toContain('feudum-halo')
            expect(chips).toBe(0)
            expect(ringed).toBe(false)
        }
        await table.closeSeatPanel()
    }
)

scenario(
    "S72 R-1.2.1, R-1.2.2, R-1.2.5 Geometry: the drawn board holds each of the logic's places, and none it lacks",
    'move-ferry',
    async (table) => {
        await table.boardAtRest()
        const discs = await attributes(
            table,
            '[data-board-surface] [data-world^="disc:"]',
            'data-world'
        )
        expect(discs.map((world) => world.slice('disc:'.length)).sort()).toEqual(
            Spaces.map(({ id }) => id).sort()
        )
        // With the printed map supplied, its routes are printed; drawn in code, each is one path.
        const routes = await attributes(table, '[data-board-surface] [data-route]', 'data-route')
        if (routes.length > 0) {
            expect(routes.sort()).toEqual(Routes.map(({ id }) => id).sort())
        }
        const score = await attributes(
            table,
            '[data-board-surface] [data-score-space]',
            'data-score-space'
        )
        expect(score.map(Number).sort((a, b) => a - b)).toEqual(
            Array.from({ length: ScoreTrack.spaces }, (_, space) => ScoreTrack.lowest + space)
        )
    }
)
