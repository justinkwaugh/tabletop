import { expect, test, type Page } from '@playwright/test'
import {
    ALLIED_ARMY,
    FRENCH_ARMY,
    createGame,
    deployBothArmies,
    deployAllies,
    failOnPageErrors,
    fillCorps,
    openSeat,
    placeFixedBattery,
    seat,
    takeFromPool,
    tap
} from './table.js'

failOnPageErrors()

const KIENMAYER_MINIMUM = 3
const KIENMAYER_LOCALE_HOLDS = 6
const ST_HILAIRE_LOCALE = 93
const ST_HILAIRE_MINIMUM = 3
const LANNES_MINIMUM = 4
const MOST_LINE_INFANTRY_IN_A_REINFORCEMENT_CORPS = 7

function units(page: Page, name: string) {
    return seat(page, name).locator('.nt-unit-tile')
}

function emptySlots(page: Page, name: string) {
    return seat(page, name).locator('.nt-setup-slot')
}

function neededSlots(page: Page, name: string) {
    return seat(page, name).locator('.nt-setup-slot-needed')
}

test('corps start empty, show what they still need, then one free slot at a time up to what their locale holds', async ({
    page
}) => {
    await createGame(page)
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    const progress = page.locator('.nt-setup-progress')
    const undo = page.getByRole('button', { name: 'Undo' })

    await expect(page.locator('.nt-setup-seat .nt-unit-tile')).toHaveCount(0)
    await expect(progress).toHaveText('44 units to assign')
    await expect(deploy).toBeDisabled()
    await expect(undo).toBeHidden()
    await expect(page.locator('svg [data-setup-locale]')).toHaveCount(9)
    await expect(neededSlots(page, 'kienmayer')).toHaveCount(KIENMAYER_MINIMUM)
    await expect(emptySlots(page, 'kienmayer')).toHaveCount(KIENMAYER_MINIMUM)

    await tap(page, 'svg [data-setup-locale="kienmayer"]')
    await expect(seat(page, 'kienmayer').locator('.nt-setup-head')).toHaveAttribute(
        'aria-pressed',
        'true'
    )
    for (let taken = 1; taken <= KIENMAYER_LOCALE_HOLDS; taken++) {
        await takeFromPool(page, '2-strength infantry')
        await expect(units(page, 'kienmayer')).toHaveCount(taken)
        await expect(neededSlots(page, 'kienmayer')).toHaveCount(
            Math.max(0, KIENMAYER_MINIMUM - taken)
        )
        await expect(emptySlots(page, 'kienmayer')).toHaveCount(
            taken < KIENMAYER_MINIMUM
                ? KIENMAYER_MINIMUM - taken
                : Number(taken < KIENMAYER_LOCALE_HOLDS)
        )
    }
    await expect(progress).toHaveText('38 units to assign')
    await expect(page.locator('.nt-setup-prompt')).toHaveText(
        'Kienmayer’s corps can take no more: Aujezd holds only 6 units.'
    )
    await expect(page.getByRole('button', { name: 'Take 2-strength infantry' })).toBeDisabled()

    await units(page, 'kienmayer').first().click()
    await expect(units(page, 'kienmayer')).toHaveCount(KIENMAYER_LOCALE_HOLDS - 1)
    await expect(page.getByRole('button', { name: 'Take 2-strength infantry' })).toBeEnabled()

    await undo.click()
    await expect(units(page, 'kienmayer')).toHaveCount(KIENMAYER_LOCALE_HOLDS)
    await undo.click()
    await expect(units(page, 'kienmayer')).toHaveCount(KIENMAYER_LOCALE_HOLDS - 1)
})

test('a tap anywhere on a seat opens it, except on a unit in it', async ({ page }) => {
    await createGame(page)
    const opened = (name: string) => seat(page, name).locator('.nt-setup-head')

    await emptySlots(page, 'kienmayer').first().click()
    await expect(opened('kienmayer')).toHaveAttribute('aria-pressed', 'true')
    await takeFromPool(page, '2-strength infantry')
    await expect(units(page, 'kienmayer')).toHaveCount(1)

    await seat(page, 'langeron').click({ position: { x: 2, y: 2 } })
    await expect(opened('langeron')).toHaveAttribute('aria-pressed', 'true')
    await expect(opened('kienmayer')).toHaveAttribute('aria-pressed', 'false')

    await units(page, 'kienmayer').first().click()
    await expect(units(page, 'kienmayer')).toHaveCount(0)
    await expect(opened('langeron')).toHaveAttribute('aria-pressed', 'true')
    await expect(opened('kienmayer')).toHaveAttribute('aria-pressed', 'false')
})

test('Undo takes back units placed and removed, never the opening of a seat', async ({ page }) => {
    await createGame(page)
    const undo = page.getByRole('button', { name: 'Undo' })
    const opened = (name: string) => seat(page, name).locator('.nt-setup-head')

    await openSeat(page, 'kienmayer')
    await openSeat(page, 'langeron')
    await expect(undo).toBeHidden()

    await takeFromPool(page, '2-strength infantry')
    await openSeat(page, 'kienmayer')
    await takeFromPool(page, '2-strength infantry')
    await openSeat(page, 'dokhturov')

    await undo.click()
    await expect(units(page, 'kienmayer')).toHaveCount(0)
    await expect(units(page, 'langeron')).toHaveCount(1)
    await expect(opened('dokhturov')).toHaveAttribute('aria-pressed', 'true')

    await undo.click()
    await expect(units(page, 'langeron')).toHaveCount(0)
    await expect(opened('dokhturov')).toHaveAttribute('aria-pressed', 'true')
    await expect(undo).toBeHidden()
})

test('the army deploys once every unit is assigned and every corps has its minimum', async ({
    page
}) => {
    await createGame(page)
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    const { prebyshevsky, ...others } = ALLIED_ARMY
    await fillCorps(page, others)
    await openSeat(page, 'prebyshevsky')
    for (const face of prebyshevsky.slice(1)) await takeFromPool(page, face)
    await expect(neededSlots(page, 'prebyshevsky')).toHaveCount(1)
    await expect(deploy).toBeDisabled()

    await takeFromPool(page, prebyshevsky[0])
    await expect(page.locator('.nt-setup-progress')).toHaveText('')
    await expect(deploy).toBeEnabled()

    await tap(page, 'svg [aria-label="Block this approach"]')
    await expect(seat(page, 'prebyshevsky').locator('.nt-setup-where').nth(1)).toContainText(
        'facing'
    )

    await deploy.click()
    await expect(page.locator('[data-seat="lannes"]')).toBeVisible()
    await expect(page.locator('[data-commander="prebyshevsky"]')).toBeVisible()
})

test('a Deploy taken back brings the set-up back as it was deployed, even after the page is reloaded', async ({
    page
}) => {
    await createGame(page)
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    const undo = page.getByRole('button', { name: 'Undo' })
    await fillCorps(page, ALLIED_ARMY)
    await tap(page, 'svg [aria-label="Block this approach"]')
    await deploy.click()
    await expect(page.locator('[data-seat="lannes"]')).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Games' }).click()
    await page.getByRole('button', { name: 'Austerlitz' }).click()
    await expect(page.locator('[data-seat="lannes"]')).toBeVisible()
    await undo.click()
    for (const [commander, faces] of Object.entries(ALLIED_ARMY)) {
        await expect(seat(page, commander).locator('.nt-unit-tile')).toHaveCount(faces.length)
    }
    await expect(seat(page, 'prebyshevsky').locator('.nt-setup-where').nth(1)).toContainText(
        'facing'
    )
    await expect(page.locator('.nt-setup-progress')).toHaveText('')
    await expect(deploy).toBeEnabled()

    await seat(page, 'bagration').locator('.nt-unit-tile').first().click()
    await expect(seat(page, 'bagration').locator('.nt-unit-tile')).toHaveCount(
        ALLIED_ARMY.bagration.length - 1
    )
    await undo.click()
    await expect(seat(page, 'bagration').locator('.nt-unit-tile')).toHaveCount(
        ALLIED_ARMY.bagration.length
    )

    await deploy.click()
    await expect(page.locator('[data-seat="lannes"]')).toBeVisible()
    await expect(page.locator('[data-commander="prebyshevsky"]')).toBeVisible()
})

test('the French Deploy taken back brings back the fixed battery on its approach', async ({
    page
}) => {
    await createGame(page)
    await deployBothArmies(page)

    await page.getByRole('button', { name: 'Undo' }).click()
    for (const [commander, faces] of Object.entries(FRENCH_ARMY)) {
        await expect(seat(page, commander).locator('.nt-unit-tile')).toHaveCount(faces.length)
    }
    await expect(seat(page, 'fixed-battery').locator('.nt-unit-tile')).toHaveCount(1)
    await expect(page.locator('.nt-setup-progress')).toHaveText('')
    await expect(page.getByRole('button', { name: 'Deploy the army' })).toBeEnabled()
})

test('the printed set-up marks show on the map until both armies are deployed', async ({
    page
}) => {
    await createGame(page)
    const marks = page.locator('img[data-setup-marks]')
    await expect(marks).toHaveCount(1)
    await deployAllies(page)
    await expect(marks).toHaveCount(1)
    await fillCorps(page, FRENCH_ARMY)
    await placeFixedBattery(page)
    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)
    await expect(marks).toHaveCount(0)
})

test('a French unit is set up on its own straight from the pool, in a locale and then on an approach of it', async ({
    page
}) => {
    await createGame(page)
    await deployAllies(page)
    const prompt = page.locator('.nt-setup-prompt')
    const left = seat(page, 'detached').locator('.nt-setup-where').nth(1)
    const undo = page.getByRole('button', { name: 'Undo' })

    await openSeat(page, 'detached')
    await expect(left).toHaveText('6 left')
    await expect(page.locator('svg [aria-label^="Move to"]')).toHaveCount(0)
    await takeFromPool(page, '2-strength cavalry')
    await expect(prompt).toHaveText('Now tap the locale it stands in.')
    await expect(page.locator('svg [aria-label="Block this approach"]')).toHaveCount(0)

    await tap(page, `svg [data-locale="${ST_HILAIRE_LOCALE}"]`)
    await expect(units(page, 'detached')).toHaveCount(1)
    await expect(left).toHaveText('5 left')
    await expect(prompt).toContainText('It stands in reserve at locale 93')
    await expect(page.locator('[data-commander="detached"]')).toHaveCount(1)
    await expect(units(page, 'st-hilaire')).toHaveCount(0)
    await expect(neededSlots(page, 'st-hilaire')).toHaveCount(ST_HILAIRE_MINIMUM)

    await tap(page, 'svg [aria-label="Block this approach"]')
    await expect(prompt).toContainText('It stands facing')

    await undo.click()
    await expect(prompt).toContainText('It stands in reserve at locale 93')
    await undo.click()
    await expect(units(page, 'detached')).toHaveCount(0)
    await expect(prompt).toHaveText('Now tap the locale it stands in.')
    await page.getByRole('button', { name: 'Put the 2-strength cavalry down' }).click()
    await expect(prompt).toContainText('Tap a unit to set it up on its own')

    await takeFromPool(page, '2-strength cavalry')
    await tap(page, `svg [data-locale="${ST_HILAIRE_LOCALE}"]`)
    await units(page, 'detached').first().click()
    await expect(units(page, 'detached')).toHaveCount(0)
    await expect(left).toHaveText('6 left')
})

test('the French fixed battery blocks an approach of a corps’s locale without using a detachment', async ({
    page
}) => {
    await createGame(page)
    await deployAllies(page)
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    const prompt = page.locator('.nt-setup-prompt')
    await openSeat(page, 'davout')
    await expect(prompt).toContainText('something other than 2-strength infantry')
    for (let taken = 0; taken < 4; taken++) await takeFromPool(page, '2-strength infantry')
    await expect(neededSlots(page, 'davout')).toHaveText('not 2-str. infantry')
    for (let returned = 0; returned < 4; returned++) await units(page, 'davout').first().click()
    await expect(units(page, 'davout')).toHaveCount(0)

    await fillCorps(page, FRENCH_ARMY)
    await expect(prompt).not.toContainText('something other than 2-strength infantry')
    await expect(page.locator('.nt-setup-progress')).toHaveText('1 unit to assign')

    await openSeat(page, 'fixed-battery')
    await expect(page.getByRole('button', { name: 'Take 3-strength infantry' })).toBeDisabled()
    await placeFixedBattery(page)
    await expect(units(page, 'fixed-battery')).toHaveCount(1)
    await expect(prompt).toContainText('The fixed battery is placed')
    await expect(seat(page, 'detached').locator('.nt-setup-where').nth(1)).toHaveText('6 left')
    await expect(deploy).toBeEnabled()

    const faced = seat(page, 'fixed-battery').locator('.nt-setup-where').nth(1)
    const facedAtFirst = await faced.innerText()
    await openSeat(page, 'lannes')
    await openSeat(page, 'fixed-battery')
    await tap(page, 'svg [aria-label="Block this approach"]')
    await expect(faced).not.toHaveText(facedAtFirst)

    await deploy.click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
})

test('a reinforcement corps takes seven two-strength infantry and then only a unit of another kind', async ({
    page
}) => {
    await createGame(page)
    await deployAllies(page)
    const lineInfantry = page.getByRole('button', { name: 'Take 2-strength infantry' })
    const prompt = page.locator('.nt-setup-prompt')

    await openSeat(page, 'bernadotte')
    for (let taken = 0; taken < MOST_LINE_INFANTRY_IN_A_REINFORCEMENT_CORPS; taken++) {
        await takeFromPool(page, '2-strength infantry')
    }
    await expect(lineInfantry).toBeDisabled()
    await expect(neededSlots(page, 'bernadotte')).toHaveText('not 2-str. infantry')
    await expect(prompt).toContainText('something other than 2-strength infantry')

    await takeFromPool(page, '2-strength cavalry')
    await expect(units(page, 'bernadotte')).toHaveCount(
        MOST_LINE_INFANTRY_IN_A_REINFORCEMENT_CORPS + 1
    )
    await expect(emptySlots(page, 'bernadotte')).toHaveCount(0)
    await expect(prompt).toHaveText(
        'Bernadotte’s corps can take no more: a corps holds 8 units at most.'
    )
})

// With this deal of the blocks the artillery units carry other numbers than in the usual deal.
const ANOTHER_DEAL = '0000000000000000000000009e3779b1'

test('with the Santon in use the fixed battery may hold the Santon from reserve, as a detachment tied to no corps', async ({
    page
}) => {
    await createGame(page, { santon: true, seed: ANOTHER_DEAL })
    await deployAllies(page)

    await expect(units(page, 'fixed-battery')).toHaveCount(0)
    await placeFixedBattery(page, { onTheSanton: true })
    await expect(units(page, 'fixed-battery')).toHaveCount(1)
    await expect(seat(page, 'fixed-battery').locator('.nt-setup-where').first()).toHaveText(
        'Santon'
    )
    await expect(seat(page, 'detached').locator('.nt-setup-where').nth(1)).toHaveText('5 left')
    await expect(page.locator('.nt-setup-progress')).toHaveText('35 units to assign')
    await expect(page.locator('.nt-setup-prompt')).toContainText('holds the Santon')
    await expect(page.locator('svg [aria-label="Block this approach"]')).toHaveCount(0)
    await expect(neededSlots(page, 'lannes')).toHaveCount(LANNES_MINIMUM)

    await fillCorps(page, FRENCH_ARMY)

    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
})

test('with the Santon in use the fixed battery may still block an approach elsewhere', async ({
    page
}) => {
    await createGame(page, { santon: true, seed: ANOTHER_DEAL })
    await deployAllies(page)
    await fillCorps(page, FRENCH_ARMY)
    await placeFixedBattery(page)

    await page.getByRole('button', { name: 'Deploy the army' }).click()
    await expect(page.locator('.nt-setup')).toHaveCount(0)
    await expect(page.locator('[data-commander="st-hilaire"]')).toBeVisible()
})

test('a published set-up lays the whole army out, to be changed or taken back', async ({
    page
}) => {
    await createGame(page)
    const progress = page.locator('.nt-setup-progress')
    const deploy = page.getByRole('button', { name: 'Deploy the army' })
    await expect(progress).toHaveText('44 units to assign')
    await expect(deploy).toBeDisabled()

    await page.locator('.nt-setup-presets select').selectOption('allied-south-attack')
    await expect(units(page, 'liechtenstein')).toHaveCount(6)
    await expect(units(page, 'kienmayer')).toHaveCount(6)
    await expect(deploy).toBeEnabled()
    await expect(page.locator('.nt-setup-presets select')).toHaveValue('')

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(progress).toHaveText('44 units to assign')
    await expect(units(page, 'kienmayer')).toHaveCount(0)
})

test('a published French set-up without the Santon leaves the fixed battery to be placed', async ({
    page
}) => {
    await createGame(page)
    await deployAllies(page)
    await page.locator('.nt-setup-presets select').selectOption('french-defend-in-place')
    await expect(page.locator('.nt-setup-progress')).toHaveText('1 unit to assign')
    await expect(page.locator('.nt-setup-prompt')).toContainText('fixed battery')
    await placeFixedBattery(page)
    await expect(page.getByRole('button', { name: 'Deploy the army' })).toBeEnabled()
})
