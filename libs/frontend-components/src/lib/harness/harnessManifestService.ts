import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { GameState, HydratedGameState } from '@tabletop/common'

export class ManifestService implements ManifestService {
    constructor(private readonly definition: GameUiDefinition<GameState, HydratedGameState>) {}

    getFrontendVersion(): string | undefined {
        throw new Error('Method not implemented.')
    }
    getLogicVersion(gameId: string): string | undefined {
        return this.definition.info.metadata.version
    }
    getUiVersion(gameId: string): string | undefined {
        return 'unknown'
    }
}
