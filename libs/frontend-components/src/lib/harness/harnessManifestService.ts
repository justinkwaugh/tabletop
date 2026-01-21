import type { GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
import type { ManifestService as ManifestServiceContract } from '$lib/services/manifestService.js'
import type { GameState, HydratedGameState } from '@tabletop/common'

export class HarnessManifestService implements ManifestServiceContract {
    constructor(private readonly definition: GameUiDefinition<GameState, HydratedGameState>) {}

    getFrontendVersion(): string | undefined {
        return undefined
    }

    getLogicVersion(_gameId: string): string | undefined {
        return this.definition.info.metadata.version
    }

    getUiVersion(_gameId: string): string | undefined {
        return this.definition.info.metadata.version
    }
}
