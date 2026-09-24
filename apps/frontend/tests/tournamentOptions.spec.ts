import { expect, test, type Page, type Request } from '@playwright/test'
import {
    ConfigOptionType,
    Role,
    UserStatus,
    type GameConfigOptions,
    type Tournament,
    type TournamentDraft,
    type User
} from '@tabletop/common'
import { mockLibrary } from './fixtures/library'

const admin: User = {
    id: 'tournament-admin',
    username: 'Admin',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

// One option presented inverted (stored `true` is the ordinary game, shown as an off toggle) and
// one plain, so the saved draft shows both senses side by side.
const options: GameConfigOptions = [
    {
        id: 'publicMoney',
        name: 'Private money',
        description: '',
        type: ConfigOptionType.Boolean,
        default: true,
        invertPresentation: true
    },
    {
        id: 'expert',
        name: 'Expert rules',
        description: '',
        type: ConfigOptionType.Boolean,
        default: false
    }
]

async function openCreateForm(page: Page) {
    await mockLibrary(page)
    await page.route('**/api/v1/user/self', (route) =>
        route.fulfill({ json: { payload: { user: admin } } })
    )
    await page.route(
        (url) => url.pathname === '/api/v1/tournaments/',
        (route) => {
            const request = route.request()
            if (request.method() === 'GET') {
                return route.fulfill({ json: { status: 'ok', payload: { tournaments: [] } } })
            }
            // A schema-valid Tournament, so the client accepts the save and the form completes
            // rather than showing a save error the request assertions would never notice.
            const { id, draft } = request.postDataJSON() as { id: string; draft: TournamentDraft }
            return route.fulfill({ json: { status: 'ok', payload: savedTournament(id, draft) } })
        }
    )
    // Registered after mockLibrary, so it wins: the same title, now with a configurator. The
    // definition is served as a module, which is what lets it carry the configurator's methods.
    await page.route('**/games/landing-0/ui/1.0.0/index.js', (route) =>
        route.fulfill({
            contentType: 'text/javascript',
            body: `export const UiDefinition = {
                info: {
                    id: 'landing-0',
                    thumbnailUrl: '/favicon-32x32.png',
                    metadata: {
                        name: 'Game 01',
                        description: 'A strategy game.',
                        designer: 'Example Designer',
                        year: '2005',
                        minPlayers: 2,
                        maxPlayers: 4,
                        defaultPlayerCount: 4,
                        version: '1.0.0'
                    },
                    configurator: {
                        options: ${JSON.stringify(options)},
                        updateConfig(config, update) { config[update.id] = update.value },
                        validateConfig() { return true }
                    }
                }
            }`
        })
    )
    await page.goto('/tournaments')
    await page.getByRole('button', { name: 'Create tournament' }).click()
    await page.getByPlaceholder('Choose a name for your tournament').fill('Options draft')
    await page.getByRole('button', { name: 'Choose a game' }).click()
    await page.getByText('Game 01', { exact: true }).click()
    await expect(page.locator('#tournament-option-publicMoney')).toBeVisible()
}

function savedTournament(id: string, draft: TournamentDraft): Tournament {
    const now = Date.now()
    return {
        ...draft,
        id,
        organizerId: admin.id,
        status: 'draft',
        revision: 1,
        entrants: [],
        stages: [],
        createdAt: now,
        updatedAt: now
    }
}

function savedDraft(page: Page): Promise<Request> {
    return page.waitForRequest(
        (request) =>
            request.method() === 'POST' &&
            new URL(request.url()).pathname === '/api/v1/tournaments/'
    )
}

// The page closes the form and navigates to the new tournament once the client has accepted
// the response - a save error leaves the form open on /tournaments instead.
async function expectSaveCompleted(page: Page, id: string) {
    await expect(page).toHaveURL(new RegExp(`/tournaments/${id}$`))
    await expect(page.getByRole('button', { name: 'Create draft' })).toBeHidden()
}

test('an untouched inverted toggle shows off and the draft keeps the raw default', async ({
    page
}) => {
    await openCreateForm(page)
    await expect(page.locator('#tournament-option-publicMoney')).not.toBeChecked()
    await expect(page.locator('#tournament-option-expert')).not.toBeChecked()

    const request = savedDraft(page)
    await page.getByRole('button', { name: 'Create draft' }).click()
    const { id, draft } = (await request).postDataJSON()
    expect(draft.rules.gameConfig).toEqual({ publicMoney: true, expert: false })
    await expectSaveCompleted(page, id)
})

test('switching an inverted toggle on saves false in the draft', async ({ page }) => {
    await openCreateForm(page)
    const toggle = page.locator('#tournament-option-publicMoney')
    await page.locator('label').filter({ has: toggle }).click()
    await expect(toggle).toBeChecked()

    const request = savedDraft(page)
    await page.getByRole('button', { name: 'Create draft' }).click()
    const { id, draft } = (await request).postDataJSON()
    expect(draft.rules.gameConfig).toEqual({ publicMoney: false, expert: false })
    await expectSaveCompleted(page, id)
})
