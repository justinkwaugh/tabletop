import type { Page } from '@playwright/test'

export async function mockLibrary(page: Page) {
    await page.route('**/api/v1/**', (route) => route.fulfill({ json: { payload: {} } }))
    const games = Array.from({ length: 13 }, (_, index) => ({
        gameId: `landing-${index}`,
        packageId: `landing-${index}`,
        logicVersion: '1.0.0',
        uiVersion: '1.0.0'
    }))

    await page.route('**/api/v1/manifest', (route) =>
        route.fulfill({ json: { payload: { frontend: { version: '18.0.0' }, games } } })
    )
    await page.route('**/api/v1/user/self', (route) => route.fulfill({ json: { payload: {} } }))
    const definitions = games.map((_game, index) => {
        return {
            info: {
                id: `landing-${index}`,
                thumbnailUrl: '/favicon-32x32.png',
                metadata: {
                    name: `Game ${String(index + 1).padStart(2, '0')}`,
                    description: `A strategy game about building connections.\nMake every turn count.`,
                    designer: 'Example Designer',
                    year: '2005',
                    minPlayers: 2,
                    maxPlayers: 4,
                    defaultPlayerCount: 3,
                    version: '1.0.0',
                    beta: index === 12
                }
            }
        }
    })
    await page.route('**/api/v1/catalog', (route) =>
        route.fulfill({ json: { payload: definitions.map((definition) => definition.info) } })
    )
    await page.route('**/games/landing-*/ui/1.0.0/index.js', (route) => {
        const index = Number(
            route
                .request()
                .url()
                .match(/landing-(\d+)/)?.[1]
        )
        const definition = definitions[index]
        return route.fulfill({
            contentType: 'text/javascript',
            body: `export const UiDefinition = ${JSON.stringify(definition)}`
        })
    })
}
