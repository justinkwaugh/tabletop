import { expect, test, type Page } from '@playwright/test'

const fixturePath = '/src/lib/components/tests/gameEditForm.fixture.ts'

async function mountForm(page: Page, reproductionSeeds: boolean) {
    await page.goto('/session-test.html')
    await page.evaluate(
        async ({ fixturePath, reproductionSeeds }) => {
            const fixture = await import(new URL(fixturePath, window.location.href).href)
            await fixture.mountGameEditForm({ reproductionSeeds })
        },
        { fixturePath, reproductionSeeds }
    )
    await nameTheGame(page)
}

async function nameTheGame(page: Page) {
    await page.getByPlaceholder('choose a name for your game').fill('Seeded')
}

async function setAdminMode(page: Page, active: boolean) {
    await page.evaluate(
        async ({ fixturePath, active }) => {
            const fixture = await import(new URL(fixturePath, window.location.href).href)
            fixture.setAdminMode(active)
        },
        { fixturePath, active }
    )
}

async function recordedCreations(page: Page) {
    return page.evaluate(async (fixturePath) => {
        const fixture = await import(new URL(fixturePath, window.location.href).href)
        return fixture.recordedCreations()
    }, fixturePath)
}

const seedField = (page: Page) => page.getByPlaceholder('optional reproduction seed')
const openSeat = (page: Page) => page.locator('input[placeholder="player name"]:not([disabled])')
const createButton = (page: Page) => page.getByRole('button', { name: 'Create Game' })

async function createAndWait(page: Page, expectedCreations: number) {
    await createButton(page).click()
    await expect.poll(async () => (await recordedCreations(page)).length).toBe(expectedCreations)
    return recordedCreations(page)
}

// Creating resets the form, as the page then leaves it, so each creation gets its own mount.
async function typeSeedThenLoseAdminMode(page: Page, reproductionSeeds: boolean, seed: string) {
    await mountForm(page, reproductionSeeds)
    await openSeat(page).fill('Guest')
    await seedField(page).fill(seed)
    await setAdminMode(page, false)
    await expect(seedField(page)).toHaveCount(0)
}

test('a reproduction seed typed in Admin Mode is not sent once the mode has ended', async ({
    page
}) => {
    await typeSeedThenLoseAdminMode(page, true, '0123456789ABCDEF0123456789abcdef')
    const ordinary = await createAndWait(page, 1)
    expect(ordinary[0]).toMatchObject({ masterSeed: undefined, seed: undefined })
})

test('the typed seed is sent again once Admin Mode is back', async ({ page }) => {
    await typeSeedThenLoseAdminMode(page, true, '0123456789ABCDEF0123456789abcdef')
    await setAdminMode(page, true)
    await expect(seedField(page)).toHaveValue('0123456789ABCDEF0123456789abcdef')
    const reproduced = await createAndWait(page, 1)
    expect(reproduced[0].masterSeed).toBe('0123456789abcdef0123456789abcdef')
})

test('a legacy numeric seed is not sent once the mode has ended', async ({ page }) => {
    await typeSeedThenLoseAdminMode(page, false, '42')
    const ordinary = await createAndWait(page, 1)
    expect(ordinary[0]).toMatchObject({ masterSeed: undefined, seed: undefined })
})

test('the legacy numeric seed is sent again once Admin Mode is back', async ({ page }) => {
    await typeSeedThenLoseAdminMode(page, false, '42')
    await setAdminMode(page, true)
    await expect(seedField(page)).toHaveValue('42')
    const reproduced = await createAndWait(page, 1)
    expect(reproduced[0].seed).toBe(42)
})

test('an unlisted choice stays available after Admin Mode ends', async ({ page }) => {
    await mountForm(page, false)
    await page.getByRole('radio', { name: 'Unlisted', exact: true }).check()
    await expect(openSeat(page)).not.toHaveAttribute('required', '')

    await setAdminMode(page, false)
    await expect(page.getByRole('radio', { name: 'Unlisted', exact: true })).toBeChecked()
    await expect(openSeat(page)).not.toHaveAttribute('required', '')
    const ordinary = await createAndWait(page, 1)
    expect(ordinary[0]).toMatchObject({ unlisted: true, isPublic: true })
})

test('an unseated owner must be seated again once Admin Mode ends', async ({ page }) => {
    await mountForm(page, false)
    await page.getByText('Include me', { exact: true }).click()
    await expect(openSeat(page)).toHaveCount(2)

    await setAdminMode(page, false)
    const lapsed = page.getByText('Admin Mode has ended')
    await expect(lapsed).toBeVisible()
    await openSeat(page).last().fill('Guest')
    await createButton(page).click()
    await page.waitForTimeout(100)
    expect(await recordedCreations(page)).toEqual([])

    await page.getByText('Include me', { exact: true }).click()
    await expect(lapsed).toHaveCount(0)
    await expect(page.getByText('Include me', { exact: true })).toHaveCount(0)
    const seated = await createAndWait(page, 1)
    expect(seated[0].ownerSeated).toBe(true)
})

async function holdRuntimeLoad(page: Page) {
    await page.evaluate(async (fixturePath) => {
        const fixture = await import(new URL(fixturePath, window.location.href).href)
        fixture.holdRuntimeLoad()
    }, fixturePath)
}

async function waitForRuntimeLoad(page: Page) {
    await expect
        .poll(() =>
            page.evaluate(async (fixturePath) => {
                const fixture = await import(new URL(fixturePath, window.location.href).href)
                return fixture.runtimeLoadCount()
            }, fixturePath)
        )
        .toBe(1)
}

async function resumeRuntimeLoad(page: Page) {
    await page.evaluate(async (fixturePath) => {
        const fixture = await import(new URL(fixturePath, window.location.href).href)
        fixture.resumeRuntimeLoad()
    }, fixturePath)
}

for (const reproductionSeeds of [true, false]) {
    test(`expiry during runtime loading removes the ${reproductionSeeds ? 'master' : 'legacy'} seed but preserves the unlisted option`, async ({
        page
    }) => {
        await mountForm(page, reproductionSeeds)
        await openSeat(page).fill('Guest')
        await page.getByRole('radio', { name: 'Unlisted', exact: true }).check()
        await seedField(page).fill(reproductionSeeds ? '0123456789abcdef0123456789abcdef' : '42')
        await holdRuntimeLoad(page)
        await createButton(page).click()
        await waitForRuntimeLoad(page)
        await setAdminMode(page, false)
        await expect(seedField(page)).toHaveCount(0)
        await resumeRuntimeLoad(page)
        await expect.poll(async () => (await recordedCreations(page)).length).toBe(1)
        expect((await recordedCreations(page))[0]).toMatchObject({
            masterSeed: undefined,
            seed: undefined,
            unlisted: true,
            isPublic: true
        })
    })
}

test('expiry during runtime loading requires the excluded owner to reclaim a seat', async ({
    page
}) => {
    await mountForm(page, false)
    await page.getByText('Include me', { exact: true }).click()
    await openSeat(page).first().fill('Guest One')
    await openSeat(page).last().fill('Guest Two')
    await seedField(page).fill('42')
    await holdRuntimeLoad(page)
    await createButton(page).click()
    await waitForRuntimeLoad(page)
    await setAdminMode(page, false)
    await resumeRuntimeLoad(page)
    await expect(page.getByText('Admin Mode has ended')).toBeVisible()
    expect(await recordedCreations(page)).toEqual([])
})

test('hotseat still requires player names after Admin Mode expires during runtime loading', async ({
    page
}) => {
    await mountForm(page, false)
    await seedField(page).fill('42')
    await holdRuntimeLoad(page)
    await createButton(page).click()
    await waitForRuntimeLoad(page)
    await page.getByRole('radio', { name: 'Hotseat', exact: true }).check()
    await setAdminMode(page, false)
    await resumeRuntimeLoad(page)
    await expect(openSeat(page)).toHaveAttribute('required', '')
    expect(await recordedCreations(page)).toEqual([])
    await openSeat(page).fill('Guest')
    const ordinary = await createAndWait(page, 1)
    expect(ordinary[0]).toMatchObject({ seed: undefined, unlisted: undefined, isPublic: false })
})
