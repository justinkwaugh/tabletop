import { FreshFishUiDefinition } from '@tabletop/fresh-fish-ui'
import { BridgesUiDefinition } from '@tabletop/bridges-of-shangri-la-ui'
import { KaivaiUiDefinition } from '@tabletop/kaivai-ui'
import { type GameUiDefinition } from '@tabletop/frontend-components'
import type { AuthorizationService } from './authorizationService.svelte'
import { Role } from '@tabletop/common'

export class LibraryService {
    private readonly titles = new Map<string, GameUiDefinition>([
        [BridgesUiDefinition.id, BridgesUiDefinition],
        [FreshFishUiDefinition.id, FreshFishUiDefinition],
        [KaivaiUiDefinition.id, KaivaiUiDefinition]
    ])

    constructor(private readonly authorizationService: AuthorizationService) {}

    getTitles(): GameUiDefinition[] {
        const user = this.authorizationService.getSessionUser()
        return Array.from(this.titles.values())
            .filter(
                (title) =>
                    !title.metadata.beta ||
                    (user &&
                        (user.roles.includes(Role.Admin) || user?.roles.includes(Role.BetaTester)))
            )
            .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name))
    }

    getTitle(id: string): GameUiDefinition | undefined {
        return this.titles.get(id)
    }

    getNameForTitle(id: string): string {
        return this.titles.get(id)?.metadata.name ?? 'Unknown Game'
    }

    getThumbnailForTitle(id: string): string {
        return this.titles.get(id)?.thumbnailUrl ?? ''
    }
}
