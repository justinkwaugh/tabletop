import { expect, test, type Locator, type Page } from '@playwright/test'
import { settled } from './helpers.js'
import { openFixture, ScenarioTable } from './scenarioTable.js'

/**
 * Contract, Spacing: a step's prompt, its choices and its send read as one group. The send stands
 * right after the last choice, the group gap from it, or starts a line of its own at the group's
 * left edge; never pushed to a far edge. Checked at the desk's two widths and the phone's.
 */

const Sizes = {
    '1920 x 1080': { viewport: { width: 1920, height: 1080 } },
    '1440 x 900': { viewport: { width: 1440, height: 900 } },
    '390 x 844': { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
} as const

type Size = keyof typeof Sizes

const isPhone = (size: Size) => size === '390 x 844'

/** The group gap: between blocks of a step, and between a choice and its send. */
const GroupGap = { desk: 8, phone: 4 } as const

const gapAt = (size: Size) => (isPhone(size) ? GroupGap.phone : GroupGap.desk)

const problems = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const seen: string[] = []
    problems.set(page, seen)
    page.on('pageerror', (error) => seen.push(error.message))
    page.on('console', (message) => {
        if (/Error (applying|handling)/.test(message.text())) {
            seen.push(message.text())
        }
    })
})

test.afterEach(({ page }) => {
    expect(problems.get(page)).toEqual([])
})

const panel = (page: Page) => page.locator('[data-action-panel]')
const popup = (page: Page) => page.locator('[data-board-popup]')

/** A press as a seat makes it at this size, then whatever it set off has finished. */
async function press(page: Page, target: Locator) {
    const touch = page.viewportSize()?.width === 390
    await (touch ? target.tap() : target.click())
    await settled(page)
}

async function openTablePage(page: Page, module: string, call: string) {
    await page.goto('/')
    await page.addScriptTag({
        type: 'module',
        content: `import * as tables from '/src/lib/testing/${module}'
            await tables.${call}
            document.body.dataset.spacingTable = ''`
    })
    await page.waitForSelector('body[data-spacing-table]', { timeout: 45_000 })
    await settled(page)
}

/** R-3.16 The Guild card (or a card that replays it), the guild's area, then its Trade. */
async function openTrade(page: Page, scene: string, guild: string, card = /^Guild/) {
    await openTablePage(page, 'benchTablePage.ts', `openBenchTable('${scene}')`)
    await press(page, panel(page).getByRole('button', { name: card }).first())
    const replay = panel(page).locator('[data-rows="replays"] [data-row="Guild"] button')
    if ((await replay.count()) > 0) {
        await press(page, replay.first())
    }
    if ((await popup(page).count()) === 0) {
        await press(
            page,
            page
                .locator(`[data-board-surface] [data-pick="guild:${guild}"] [role="button"]`)
                .first()
        )
    }
    await press(
        page,
        popup(page)
            .locator('button')
            .filter({ hasText: /^\s*Trade/ })
            .first()
    )
}

interface Placement {
    /** It stands on a line with the element before it. */
    readonly sameLine: boolean
    /** From the element before it, on its line. */
    readonly gap: number
    /** From its container's left content edge. */
    readonly inset: number
}

/** Where an element stands in its container's flow against the element before it. */
async function placementOf(target: Locator): Promise<Placement> {
    return target.evaluate((element) => {
        let before = element.previousElementSibling
        while (before && before.getBoundingClientRect().width === 0) {
            before = before.previousElementSibling
        }
        // A phone pins its sends to the action area's foot: read where they stand in the flow.
        const pinned = element as HTMLElement
        const position = pinned.style.position
        pinned.style.position = 'static'
        const box = element.getBoundingClientRect()
        pinned.style.position = position
        const container = element.parentElement
        if (!container) {
            throw new Error('it stands in nothing')
        }
        // First in its container, it stands at the line's start.
        const prior = before?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0)
        const style = getComputedStyle(container)
        const contentLeft =
            container.getBoundingClientRect().left +
            parseFloat(style.borderLeftWidth) +
            parseFloat(style.paddingLeft)
        return {
            sameLine: before !== null && prior.bottom > box.top + 1 && prior.top < box.bottom - 1,
            gap: Math.round(box.left - prior.right),
            inset: Math.round(box.left - contentLeft)
        }
    })
}

/** The rule: on the line of what it follows, the group gap after it; else at the line's start. */
function expectGroupedAfter(placement: Placement, size: Size) {
    if (placement.sameLine) {
        expect(placement.gap).toBe(gapAt(size))
    } else {
        expect(placement.inset).toBe(0)
    }
}

const sends = (page: Page) => panel(page).locator('.sends').first()

/** The panels whose send follows the step's blocks in the panel's own line. */
const PanelSteps: readonly [string, (page: Page, phone: boolean) => Promise<void>][] = [
    [
        'R-3.11.3 the favours: Take stands after the goods',
        async (page, phone) => {
            await openFixture(page, 'cards-harvest-farmer')
            const table = new ScenarioTable(page, phone)
            await table.press(table.card('Harvest'))
            await table.pressPick('space:space.desert.3')
            await table.press(table.popupRow('Inspect the harvest'))
            await table.press(table.primary())
            await table.press(
                table.panel().locator('[data-rows="goods"] [data-row] button').first()
            )
        }
    ],
    [
        'R-4.4.1 the kept writs: both sends start the line under the writs',
        async (page, phone) => {
            await openFixture(page, 'cards-explore')
            const table = new ScenarioTable(page, phone)
            await table.press(table.card('Explore'))
            await table.press(table.primary())
            await table.press(
                table.panel().locator('[data-writs] [data-row]').last().locator('button').first()
            )
        }
    ],
    [
        "R-3.14.1 the defender's answers stand after the tally",
        async (page) =>
            openTablePage(page, 'followUpTablePage.ts', "openDefendTable(true, 'asked')")
    ],
    [
        'R-3.14.2 the starve answers stand after the line',
        async (page) =>
            openTablePage(page, 'followUpTablePage.ts', "openStarveTable(true, 'asked')")
    ],
    [
        'R-4.12.3 the landscapes: Leave all stands after the landscapes',
        async (page) => openTablePage(page, 'followUpTablePage.ts', 'openDawnTable()')
    ]
]

for (const size of Object.keys(Sizes) as Size[]) {
    test.describe(size, () => {
        test.use(Sizes[size])

        for (const [title, open] of PanelSteps) {
            test(title, async ({ page }) => {
                await open(page, isPhone(size))
                await expect(sends(page)).toBeVisible()
                expectGroupedAfter(await placementOf(sends(page)), size)
                // Two sends stand the group gap apart, or each on a line of its own.
                const each = sends(page).locator('[data-primary]')
                if ((await each.count()) > 1) {
                    expectGroupedAfter(await placementOf(each.nth(1)), size)
                }
            })
        }

        test("R-3.12 a card's tray: its send stands after its rows", async ({ page }) => {
            await openFixture(page, 'cards-tax-knight')
            const table = new ScenarioTable(page, isPhone(size))
            await table.press(table.card('Tax'))
            const send = page.locator('[data-card-tray] .sends')
            await expect(send).toBeVisible()
            expectGroupedAfter(await placementOf(send), size)
        })

        test('R-4.10.1 the nourish summary: the send stands the group gap after its line', async ({
            page
        }) => {
            await openTablePage(page, 'followUpTablePage.ts', "openNourishTable('seat')")
            const summary = page.locator('[data-nourish-summary]')
            const send = summary.locator('[data-primary]')
            await expect(send).toBeVisible()
            const [line, button] = await Promise.all([
                summary.locator('[data-nourish-rule]').boundingBox(),
                send.boundingBox()
            ])
            if (isPhone(size)) {
                // On a phone the short rule and the send share a line, the send right after it.
                expect(Math.round((button?.x ?? 0) - ((line?.x ?? 0) + (line?.width ?? 0)))).toBe(
                    GroupGap.phone
                )
            } else {
                expect(Math.round((button?.y ?? 0) - ((line?.y ?? 0) + (line?.height ?? 0)))).toBe(
                    GroupGap.desk
                )
                // The summary is as wide as a column of its words, not the rest of the line.
                expect((await summary.boundingBox())?.width ?? 0).toBeLessThanOrEqual(384)
            }
        })

        test('R-4.12 the dawn sheet stands as wide as its columns', async ({ page }) => {
            await openTablePage(page, 'followUpTablePage.ts', 'openDawnTable()')
            const sheet = page.locator('[data-dawn-sheet]')
            await expect(sheet).toBeVisible()
            const table = sheet.locator('table')
            if (isPhone(size)) {
                // A phone's sheet is one seat per row instead.
                await expect(table).toHaveCount(0)
                return
            }
            const [drawn, content] = await table.evaluate((element) => {
                const width = element.getBoundingClientRect().width
                element.style.width = 'max-content'
                const fits = element.getBoundingClientRect().width
                element.style.width = ''
                return [width, fits]
            })
            expect(Math.abs(drawn - content)).toBeLessThanOrEqual(1)
        })
    })
}

/** Contract, The trade picker: each guild's, in one reading order. */
const Trades = [
    ['alchemistTrade', 'alchemist'],
    ['knightTrade', 'knight'],
    ['merchantTrade', 'merchant'],
    ['nobleTrade', 'noble'],
    ['monkTrade', 'monk']
] as const

const picker = (page: Page) => page.locator('[data-trade-picker]')
const tray = (page: Page) => page.locator('[data-card-tray]')
const forfeit = (page: Page) => tray(page).locator('[data-rows="card"]')

for (const size of ['1920 x 1080', '1440 x 900'] as const) {
    test.describe(`${size} trade picker`, () => {
        test.use(Sizes[size])

        for (const [scene, guild] of Trades) {
            test(`R-4.6.2, R-4.6.3 the ${guild} trade reads in one order`, async ({ page }) => {
                await openTrade(page, scene, guild)
                await expect(picker(page)).toBeVisible()
                // The control row heads the tray: Forfeit stands above the picker, at its start.
                const [control, board] = await Promise.all([
                    forfeit(page).boundingBox(),
                    picker(page).boundingBox()
                ])
                expect((control?.y ?? 0) + (control?.height ?? 0)).toBeLessThanOrEqual(
                    (board?.y ?? 0) + 1
                )
                expectGroupedAfter(await placementOf(forfeit(page)), size)
                // "you have" follows the header's line, the header's gap after it.
                const purse = await placementOf(picker(page).locator('[data-purse]'))
                expect(purse.sameLine).toBe(true)
                expect(purse.gap).toBe(GroupGap.desk)
                // The picker is the guild's height: nothing wraps under the guild.
                const upright = await picker(page).locator('[data-upright-guild]').boundingBox()
                expect(Math.abs((board?.height ?? 0) - (upright?.height ?? 0))).toBeLessThanOrEqual(
                    1
                )
            })
        }

        test('R-3.15 a replayed Guild: the replays and Forfeit share the control row', async ({
            page
        }) => {
            await openTrade(page, 'repeatKnightTrade', 'knight', /^Repeat/)
            await expect(picker(page)).toBeVisible()
            const [replays, control, board] = await Promise.all([
                tray(page).locator('[data-rows="replays"]').boundingBox(),
                forfeit(page).boundingBox(),
                picker(page).boundingBox()
            ])
            // One row: Forfeit's middle on the replays' middle, the group gap after them.
            const middle = (box: typeof replays) => (box?.y ?? 0) + (box?.height ?? 0) / 2
            expect(Math.abs(middle(control) - middle(replays))).toBeLessThanOrEqual(1)
            const end = await placementOf(forfeit(page))
            expect(end.sameLine).toBe(true)
            expect(end.gap).toBe(GroupGap.desk)
            // The row stands above the picker.
            for (const box of [replays, control]) {
                expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((board?.y ?? 0) + 1)
            }
        })
    })
}

test.describe('390 x 844 trade picker', () => {
    test.use(Sizes['390 x 844'])

    for (const [scene, guild] of Trades) {
        test(`R-4.6.2, R-4.6.3 the ${guild} trade's sheet: "you have" follows the title`, async ({
            page
        }) => {
            await openTrade(page, scene, guild)
            await expect(picker(page)).toBeVisible()
            // The header keeps its desk gap; a long title sends the purse to the next line's start.
            expectGroupedAfter(
                await placementOf(picker(page).locator('[data-purse]')),
                '1440 x 900'
            )
        })
    }
})
