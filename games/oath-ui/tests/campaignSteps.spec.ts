import { expect, test, type Locator, type Page } from '@playwright/test'
import type * as TableFixture from '../src/lib/testing/tableFixture.js'

type Fixture = typeof TableFixture

async function call<K extends keyof Fixture>(
    page: Page,
    name: K,
    ...args: Parameters<Fixture[K]>
): Promise<Awaited<ReturnType<Fixture[K]>>> {
    return page.evaluate(
        async ({ name, args }) => {
            const fixture = await import(
                new URL('/src/lib/testing/tableFixture.ts', location.href).href
            )
            return fixture[name](...args)
        },
        { name, args }
    )
}

async function openTable(page: Page, name: TableFixture.TableName) {
    await page.goto('/')
    await call(page, 'open', name)
    await expect.poll(async () => (await call(page, 'tableFacts')).seatId).toBe('Dana')
}

/** The layout's size, unscaled. */
async function layoutSize(locator: Locator) {
    return locator.evaluate((element) =>
        element instanceof HTMLElement
            ? { width: element.offsetWidth, height: element.offsetHeight }
            : { width: 0, height: 0 }
    )
}

/** The size drawn on the screen, after the phone panel's fit. */
async function drawnSize(locator: Locator) {
    return locator.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return { width: box.width, height: box.height, top: box.top }
    })
}

const panel = (page: Page) => page.locator('.panel')
const campaignTile = (page: Page) =>
    panel(page).locator('.majors button').filter({ hasText: 'Campaign' })
const button = (page: Page, name: string) => panel(page).getByRole('button', { name, exact: true })
const header = (page: Page) => panel(page).locator('[data-step-heading]')
const stepHeading = (page: Page) => header(page).locator('h4')
const group = (page: Page, heading: string) =>
    panel(page).locator('h4', { hasText: heading }).locator('xpath=following-sibling::div[1]')
const rows = (page: Page, heading: string) => group(page, heading).locator('button[aria-pressed]')
const row = (page: Page, name: string | RegExp) =>
    panel(page).locator('button[aria-pressed]').filter({ hasText: name })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
const pool = (page: Page) =>
    panel(page).getByRole('button', { name: /^Attack die \d, in the pool$/ })
const targetedSites = (page: Page) => page.locator('.site.targeted')
/** A lit site's pick on the map, named by the site and its chip ("Plains, target?"). */
const sitePick = (page: Page, name: string) =>
    page.getByRole('button', { name: new RegExp(`^${name}, `) })
const mapSite = (page: Page, name: string) => page.locator('.site').locator(sitePick(page, name))
const siteChip = (page: Page, name: string) =>
    page.locator('.site', { has: sitePick(page, name) }).locator('.travel-cost')
const siteChips = (page: Page, words: string) =>
    page.locator('.site .travel-cost').filter({ hasText: words })

const SIZES = [
    { name: 'desktop', viewport: { width: 1280, height: 900 }, phone: false },
    { name: 'phone', viewport: { width: 375, height: 812 }, phone: true }
]

async function shot(page: Page, name: string, phone: boolean) {
    await page.mouse.move(2, 2)
    await panel(page).screenshot({
        path: test.info().outputPath(`${name}-${phone ? 'phone' : 'desktop'}.png`)
    })
}

/** On a phone a site is a target picked on the map; the rest are the panel's rows. */
async function tapSite(page: Page, name: string) {
    await mapSite(page, name).click()
}

async function pickTargets(page: Page, phone: boolean) {
    for (const name of ['Plains', 'River']) {
        if (phone) {
            await tapSite(page, name)
            await expect(siteChip(page, name)).toHaveText('✓ target')
        } else {
            await row(page, new RegExp(name)).click()
            await expect(row(page, new RegExp(name))).toHaveAttribute('aria-pressed', 'true')
        }
    }
    for (const name of [/Cup of Plenty/, /Ann/]) {
        await row(page, name).click()
        await expect(row(page, name)).toHaveAttribute('aria-pressed', 'true')
    }
}

/**
 * On a phone, everything tappable is laid out at least 44 px tall; `drawn`: and drawn so, the
 * panel's fit not having shrunk the step.
 */
async function expectTappable(locators: Locator[], phone: boolean, size: 'drawn' | 'laidOut') {
    if (!phone) return
    for (const locator of locators) {
        expect((await layoutSize(locator)).height).toBeGreaterThanOrEqual(44)
        if (size === 'drawn') expect((await drawnSize(locator)).height).toBeGreaterThanOrEqual(44)
    }
}

async function expectNoPageOverflow(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
}

for (const { name, viewport, phone } of SIZES) {
    /**
     * R-5.5.1 to R-5.5.3 — Dana (an Exile) campaigns from the Plains against Ann (the Chancellor),
     * who rules six sites and holds two relics; Dana rules Outriders and Scouts.
     */
    test.describe(`the Campaign declared in three steps, on a ${name}`, () => {
        test.use({ viewport, hasTouch: phone })

        test(`Targets 1 of 3: each kind’s rows share one width and wrap across the panel${phone ? ', the sites left to the map' : ''}; Next fits its label`, async ({
            page
        }) => {
            await openTable(page, 'campaignSteps')
            await campaignTile(page).click()
            await expect(panel(page)).toContainText(/Against Ann\./)
            await expect(panel(page)).not.toContainText('Tap targets')
            await expect(stepHeading(page)).toHaveText('Targets')
            await expect(header(page)).toContainText('1 of 3')
            await expect(header(page).locator('.rounded-full')).toHaveCount(3)
            await expect(button(page, 'Next')).toHaveCount(0)

            await pickTargets(page, phone)
            // On a phone the Sites rows are left out: the map lights the six and a tap picks one.
            await expect(panel(page).locator('h4', { hasText: 'Sites' })).toHaveCount(phone ? 0 : 1)
            await expect(rows(page, 'Sites')).toHaveCount(phone ? 0 : 6)
            await expect(rows(page, 'Relics and banners')).toHaveCount(2)
            await expect(rows(page, 'Pawn and favor')).toHaveCount(1)
            await expect(targetedSites(page)).toHaveCount(2)
            await expect(siteChips(page, '✓ target')).toHaveCount(2)
            await expect(siteChips(page, 'target?')).toHaveCount(4)
            await expect(button(page, 'Next')).toBeVisible()

            const panelWidth = (await layoutSize(panel(page))).width
            for (const heading of phone
                ? ['Relics and banners']
                : ['Sites', 'Relics and banners']) {
                const sizes = await rows(page, heading).evaluateAll((buttons) =>
                    buttons.map((element) => ({
                        width: element instanceof HTMLElement ? element.offsetWidth : 0,
                        top: Math.round(element.getBoundingClientRect().top)
                    }))
                )
                for (const size of sizes) {
                    expect(size.width).toBeGreaterThan(0)
                    expect(Math.abs(size.width - sizes[0].width)).toBeLessThanOrEqual(1)
                    expect(size.width).toBeLessThan(panelWidth)
                }
                // Wrapped across the width: two rows of the group share a line. On a phone the two
                // relics' shared width takes a line each.
                if (!phone) {
                    expect(new Set(sizes.map((size) => size.top)).size).toBeLessThan(sizes.length)
                }
            }
            const next = button(page, 'Next')
            expect((await layoutSize(next)).width).toBeLessThan(panelWidth / 4)
            // The relics, the pawn and Next still outgrow the phone's panel, so its fit scales this
            // step down; the rows are still laid out 44 px tall.
            await expectTappable(
                [...(await panel(page).locator('button[aria-pressed]').all()), next],
                phone,
                'laidOut'
            )
            await expectNoPageOverflow(page)
            await shot(page, 'campaign-step1', phone)
        })

        test('Attack dice 2 of 3, Battle plans 3 of 3, then Declare starts the Campaign', async ({
            page
        }) => {
            await openTable(page, 'campaignSteps')
            await campaignTile(page).click()
            await pickTargets(page, phone)
            await button(page, 'Next').click()

            await expect(stepHeading(page)).toHaveText('Attack dice')
            await expect(header(page)).toContainText('2 of 3')
            await expect(rows(page, 'Sites')).toHaveCount(0)
            await expect(targetedSites(page)).toHaveCount(0)
            await expect(button(page, 'Next')).toHaveCount(0)
            await panel(page).getByRole('button', { name: 'Add attack die 3' }).click()
            await expect(pool(page)).toHaveCount(3)
            await expect(panel(page)).toContainText('3 of 4')
            await expect(button(page, 'Next')).toBeVisible()
            await expect(button(page, 'Declare')).toHaveCount(0)
            await expectTappable(
                [
                    ...(await panel(page)
                        .getByRole('button', { name: /attack die \d/ })
                        .all()),
                    button(page, 'Next')
                ],
                phone,
                'drawn'
            )
            await shot(page, 'campaign-step2', phone)
            await button(page, 'Next').click()

            await expect(stepHeading(page)).toHaveText('Battle plans')
            await expect(header(page)).toContainText('3 of 3')
            await expect(panel(page).locator('[data-plan-rows] button[aria-pressed]')).toHaveCount(
                2
            )
            await expect(panel(page)).toContainText('Outriders')
            await expect(panel(page)).toContainText('Scouts')
            await expect(button(page, 'Next')).toHaveCount(0)
            const declare = button(page, 'Declare')
            await expect(declare).toBeVisible()
            expect((await layoutSize(declare)).width).toBeLessThan(
                (await layoutSize(panel(page))).width / 4
            )
            await expectTappable(
                [
                    ...(await panel(page).locator('[data-plan-rows] button[aria-pressed]').all()),
                    declare
                ],
                phone,
                'drawn'
            )
            await expectNoPageOverflow(page)
            await shot(page, 'campaign-step3', phone)

            await declare.click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).campaignUnderway)
                .toBe(true)
        })

        test('Undo goes back a step, the earlier step’s picks still marked', async ({ page }) => {
            await openTable(page, 'campaignSteps')
            await campaignTile(page).click()
            await pickTargets(page, phone)
            await button(page, 'Next').click()
            await panel(page).getByRole('button', { name: 'Add attack die 3' }).click()
            await button(page, 'Next').click()
            await expect(stepHeading(page)).toHaveText('Battle plans')

            await undo(page).click()
            await expect(stepHeading(page)).toHaveText('Attack dice')
            await expect(pool(page)).toHaveCount(3)
            await expect(button(page, 'Next')).toBeVisible()

            await undo(page).click()
            await expect(stepHeading(page)).toHaveText('Targets')
            // On a phone the two sites are marked on the map only.
            await expect(panel(page).locator('button[aria-pressed="true"]')).toHaveCount(
                phone ? 2 : 4
            )
            await expect(targetedSites(page)).toHaveCount(2)

            await undo(page).click()
            await expect(row(page, /Ann/)).toHaveAttribute('aria-pressed', 'false')
            await expect(panel(page).locator('button[aria-pressed="true"]')).toHaveCount(
                phone ? 1 : 3
            )
            await expect(targetedSites(page)).toHaveCount(2)
        })

        test('with no battle plan to declare, the header counts two steps and Declare follows the dice', async ({
            page
        }) => {
            await openTable(page, 'campaignStepsNoPlans')
            await campaignTile(page).click()
            await expect(header(page)).toContainText('1 of 2')
            await expect(header(page).locator('.rounded-full')).toHaveCount(2)
            await pickTargets(page, phone)
            await button(page, 'Next').click()
            await expect(stepHeading(page)).toHaveText('Attack dice')
            await expect(header(page)).toContainText('2 of 2')
            await panel(page).getByRole('button', { name: 'Add attack die 2' }).click()
            await expect(button(page, 'Next')).toHaveCount(0)
            await expect(button(page, 'Declare')).toBeVisible()
            await button(page, 'Declare').click()
            await expect
                .poll(async () => (await call(page, 'tableFacts')).campaignUnderway)
                .toBe(true)
        })
    })
}

/**
 * R-5.5.2 — on a phone the Targets step leaves the sites to the map: the map lights each site the
 * Campaign can target ("target?"), a tap targets it ("✓ target") and a second tap drops it. Off
 * the Targets step the map picks nothing. On a desktop the panel's Sites rows pick, as before.
 */
test.describe('the sites targeted on the map, on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

    test('a tap on a lit site targets it and a second tap drops it; Next follows the targets', async ({
        page
    }) => {
        await openTable(page, 'campaignSteps')
        await campaignTile(page).click()
        await expect(stepHeading(page)).toHaveText('Targets')
        await expect(panel(page).locator('h4', { hasText: 'Sites' })).toHaveCount(0)
        // Ann rules Dana's Plains, so the Plains comes first: the map lights it alone, as the
        // Sites rows would list it alone.
        await expect(siteChips(page, 'target?')).toHaveCount(1)
        await expect(siteChip(page, 'Plains')).toHaveText('target?')
        await expect(button(page, 'Next')).toHaveCount(0)

        await tapSite(page, 'Plains')
        await expect(siteChips(page, 'target?')).toHaveCount(5)
        await expect(siteChip(page, 'Plains')).toHaveText('✓ target')
        await expect(targetedSites(page)).toHaveCount(1)
        await expect(button(page, 'Next')).toBeVisible()

        await tapSite(page, 'Plains')
        await expect(siteChip(page, 'Plains')).toHaveText('target?')
        await expect(targetedSites(page)).toHaveCount(0)
        await expect(button(page, 'Next')).toHaveCount(0)
    })

    test('after Next the map picks nothing and the targets hold; Undo brings the picks back', async ({
        page
    }) => {
        await openTable(page, 'campaignSteps')
        await campaignTile(page).click()
        await tapSite(page, 'Plains')
        await tapSite(page, 'River')
        await expect(targetedSites(page)).toHaveCount(2)
        await button(page, 'Next').click()

        await expect(stepHeading(page)).toHaveText('Attack dice')
        await expect(page.locator('.site .board-card__pick')).toHaveCount(0)
        await expect(page.locator('.site .travel-cost')).toHaveCount(0)

        await undo(page).click()
        await expect(stepHeading(page)).toHaveText('Targets')
        await expect(siteChip(page, 'Plains')).toHaveText('✓ target')
        await expect(siteChip(page, 'River')).toHaveText('✓ target')
        await tapSite(page, 'River')
        await expect(siteChip(page, 'River')).toHaveText('target?')
        await expect(targetedSites(page)).toHaveCount(1)
    })

    test('with only sites to target, the step keeps its heading and Next follows a tap on the map', async ({
        page
    }) => {
        await openTable(page, 'campaignStepsSitesOnly')
        await campaignTile(page).click()
        await expect(panel(page)).toContainText(/Against Ann\./)
        await expect(stepHeading(page)).toHaveText('Targets')
        await expect(header(page)).toContainText('1 of 3')
        await expect(panel(page).locator('button[aria-pressed]')).toHaveCount(0)
        await expect(button(page, 'Next')).toHaveCount(0)

        await tapSite(page, 'Plains')
        await expect(siteChip(page, 'Plains')).toHaveText('✓ target')
        await expect(button(page, 'Next')).toBeVisible()
    })

    test('Relic Hunter: a site tapped on the map lists the relic there in the panel', async ({
        page
    }) => {
        await openTable(page, 'campaignStepsRelicHunter')
        await campaignTile(page).click()
        await tapSite(page, 'Plains')
        await expect(row(page, /relic at River/)).toHaveCount(0)

        await tapSite(page, 'River')
        await expect(
            rows(page, 'Relics and banners').filter({ hasText: /relic at River/ })
        ).toHaveCount(1)
        await row(page, /relic at River/).click()
        await expect(row(page, /relic at River/)).toHaveAttribute('aria-pressed', 'true')

        await tapSite(page, 'River')
        await expect(row(page, /relic at River/)).toHaveCount(0)
        await expect(targetedSites(page)).toHaveCount(1)
    })
})

test.describe('the sites targeted in the panel, on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } })

    test('the Sites rows pick, and the lit map keeps its cards for looking', async ({ page }) => {
        await openTable(page, 'campaignSteps')
        await campaignTile(page).click()
        // The rows list the Plains alone until it is targeted; the map lights all six, as before.
        await expect(rows(page, 'Sites')).toHaveCount(1)
        await expect(siteChips(page, 'target?')).toHaveCount(6)
        await expect(page.locator('.site .board-card__pick')).toHaveCount(0)

        await row(page, /Plains/).click()
        await expect(siteChips(page, '✓ target')).toHaveCount(1)
        await expect(rows(page, 'Sites')).toHaveCount(6)
    })
})
