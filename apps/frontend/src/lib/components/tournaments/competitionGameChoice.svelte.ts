import {
    defaultGameConfig,
    normalizeGameConfig,
    type ConfigOption,
    type GameConfig
} from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'
import type { LibraryService } from '$lib/services/libraryService.svelte'

type TitleLibrary = Pick<LibraryService, 'titlesById'>
type LibraryTitle = LibraryService['titlesById'][string]

export class CompetitionGameChoice {
    titleId = $state('')
    rawConfig: GameConfig = $state({})
    titlesError = $state('')
    eligibleTitleIds: Set<string> | undefined = $state()
    title = $derived.by(() => this.library.titlesById[this.titleId])
    config = $derived.by(() => normalizeGameConfig(this.rawConfig, this.title?.info.configurator))
    titles = $derived.by(() =>
        Object.values(this.library.titlesById)
            .filter(
                (item) =>
                    this.eligibleTitleIds?.has(item.info.id) || item.info.id === this.initialTitleId
            )
            .sort((a, b) => a.info.metadata.name.localeCompare(b.info.metadata.name))
    )

    constructor(
        private readonly library: TitleLibrary,
        private readonly initialTitleId = '',
        initialConfig: GameConfig = {}
    ) {
        this.titleId = initialTitleId
        this.rawConfig = { ...initialConfig }
    }

    async loadEligibleTitles(api: Pick<TabletopApi, 'listTournamentTitles'>, failureText: string) {
        try {
            this.eligibleTitleIds = new Set((await api.listTournamentTitles()).titleIds)
        } catch {
            this.titlesError = failureText
        }
    }

    select(titleId: string): LibraryTitle | undefined {
        this.titleId = titleId
        const selected = this.library.titlesById[titleId]
        if (selected) this.rawConfig = defaultGameConfig(selected.info.configurator?.options ?? [])
        return selected
    }

    updateOption(option: ConfigOption, value: string | number | boolean | null) {
        const updated = { ...this.config }
        this.title?.info.configurator?.updateConfig(updated, { id: option.id, value })
        this.rawConfig = updated
    }
}
