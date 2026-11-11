import type { GameDefinition } from '@tabletop/common'

function unused(): never {
    throw new Error('Unused by route test')
}

export function routeTestDefinition(id: string, description: string): GameDefinition {
    return {
        info: {
            id,
            metadata: {
                name: id,
                designer: 'Test',
                description,
                year: '2026',
                minPlayers: 1,
                maxPlayers: 1,
                defaultPlayerCount: 1,
                version: '1.0.0',
                beta: true
            }
        },
        runtime: {
            initializer: { initializeGame: unused, initializeGameState: unused },
            hydrator: { hydrateAction: unused, hydrateState: unused },
            playerColors: [],
            apiActions: {},
            stateHandlers: {}
        }
    }
}
