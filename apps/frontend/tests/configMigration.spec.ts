import { expect, test } from '@playwright/test'
import {
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type User,
    type Tournament
} from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const user: User = {
    id: 'host',
    username: 'Host',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}
const legacyGame: Game = {
    id: 'legacy-config',
    typeId: 'landing-0',
    name: 'Legacy private table',
    ownerId: user.id,
    status: GameStatus.WaitingForPlayers,
    isPublic: false,
    deleted: false,
    hotseat: false,
    config: { publicMoney: false },
    createdAt: new Date('2026-09-01'),
    winningPlayerIds: [],
    players: [
        { id: 'p1', userId: user.id, name: 'Host', status: PlayerStatus.Joined, isHuman: true },
        { id: 'p2', name: '', status: PlayerStatus.Open, isHuman: true }
    ]
}

test.beforeEach(async ({ page }) => {
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user } } })
    )
    await page.route('**/games/landing-0/ui/1.0.0/index.js', (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: `export const UiDefinition = {
                info: {
                    id: 'landing-0', thumbnailUrl: '/favicon-32x32.png',
                    metadata: { name: 'Game 01', description: '', designer: '', year: '',
                        minPlayers: 2, maxPlayers: 4, defaultPlayerCount: 3, version: '1.0.0' },
                    configurator: {
                        options: [{ id: 'privateMoney', name: 'Private money', description: '', type: 'Boolean', default: false }],
                        normalizeConfig(config) {
                            const { publicMoney, ...current } = config;
                            return { ...current, privateMoney: publicMoney === undefined ? current.privateMoney ?? false : !publicMoney };
                        },
                        updateConfig(config, update) { config[update.id] = update.value },
                        validateConfig() {}
                    }
                }
            }`
        })
    )
})

for (const turnOff of [false, true]) {
    test(`editing a legacy configuration preserves its meaning; turn off = ${turnOff}`, async ({
        page
    }) => {
        await page.route('**/api/v1/games/mine*', (route) =>
            route.fulfill({ json: { payload: { games: [legacyGame] } } })
        )
        await page.route('**/api/v1/game/update', async (route) => {
            const { game } = route.request().postDataJSON()
            expect(game.config).toEqual({ privateMoney: !turnOff })
            await route.fulfill({ json: { payload: { game: { ...legacyGame, ...game } } } })
        })
        await page.goto('/dashboard')
        await page.getByRole('button', { name: 'Edit', exact: true }).click()
        await expect(page.locator('#privateMoney')).toBeChecked()
        if (turnOff)
            await page
                .locator('label')
                .filter({ has: page.locator('#privateMoney') })
                .click()
        await page.getByPlaceholder('player name').nth(1).fill('Guest')
        const saved = page.waitForResponse('**/api/v1/game/update')
        await page.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await saved).status()).toBe(200)
        await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden()
    })
}

for (const turnOff of [false, true]) {
    test(`editing a legacy tournament preserves its meaning; turn off = ${turnOff}`, async ({
        page
    }) => {
        let tournament: Tournament = {
            id: 'legacy-draft',
            name: 'Legacy tournament',
            description: '',
            organizerId: user.id,
            status: 'draft',
            revision: 1,
            entrants: [],
            stages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            format: { kind: 'mini', stages: [{ id: 'opening', name: 'Main', gamesPerEntrant: 2 }] },
            rules: {
                titleId: 'landing-0',
                tableSize: 2,
                concurrency: 2,
                scoring: 'splitWinsV1',
                registration: { kind: 'whenFull', capacity: 2 },
                gameConfig: { publicMoney: false }
            }
        }
        await page.route('**/api/v1/tournaments/legacy-draft', async (route) => {
            if (route.request().method() === 'PUT') {
                const { draft } = route.request().postDataJSON()
                expect(draft.rules.gameConfig).toEqual({ privateMoney: !turnOff })
                tournament = { ...tournament, ...draft, revision: 2 }
                await route.fulfill({ json: { status: 'ok', payload: tournament } })
            } else {
                await route.fulfill({
                    json: { status: 'ok', payload: { tournament, usernames: {} } }
                })
            }
        })
        await page.goto('/tournaments/legacy-draft')
        await page.getByRole('button', { name: 'Edit draft', exact: true }).click()
        const toggle = page.locator('#tournament-option-privateMoney')
        await expect(toggle).toBeChecked()
        if (turnOff) await page.locator('label').filter({ has: toggle }).click()
        const saved = page.waitForResponse(
            (response) =>
                response.url().endsWith('/tournaments/legacy-draft') &&
                response.request().method() === 'PUT'
        )
        await page.getByRole('button', { name: 'Save draft', exact: true }).click()
        expect((await saved).status()).toBe(200)
        await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeHidden()
    })
}
