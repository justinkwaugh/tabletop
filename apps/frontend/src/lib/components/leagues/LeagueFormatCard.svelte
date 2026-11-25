<script lang="ts">
    import type { GameConfigurator, League } from '@tabletop/common'
    import { m } from '$lib/paraglide/messages'
    import { tournamentScoringText } from '$lib/utils/tournamentPresentation'
    import TournamentGameOptions from '../tournaments/TournamentGameOptions.svelte'

    let {
        league,
        titleName,
        configurator
    }: { league: League; titleName: string; configurator?: GameConfigurator } = $props()
    let rules = $derived(league.rules)
    let rows = $derived([
        [m.leagues_format_game(), titleName],
        [
            m.leagues_format_shape(),
            league.shape === 'pyramid'
                ? m.leagues_format_shape_pyramid()
                : m.leagues_format_shape_ladder()
        ],
        [
            m.leagues_format_groups(),
            m.leagues_format_groups_detail({
                groupSize: rules.sizes.groupSize,
                bottomMinimum: rules.sizes.bottomMinimum,
                bottomMaximum: rules.sizes.bottomMaximum
            })
        ],
        [
            m.leagues_format_games(),
            m.leagues_format_games_detail({
                gamesPerEntrant: rules.gamesPerEntrant,
                tableSize: rules.tableSize
            })
        ],
        [m.leagues_format_ranking(), tournamentScoringText(rules)],
        [m.leagues_format_at_once(), m.leagues_format_at_once_detail({ count: rules.concurrency })],
        [
            m.leagues_between_seasons(),
            league.signUp.opensAutomatically
                ? m.leagues_format_sign_up_automatic({ days: league.signUp.days })
                : m.leagues_format_sign_up_by_administrator({ days: league.signUp.days })
        ]
    ])
</script>

<aside
    aria-labelledby="format-heading"
    class="rounded-lg border border-gray-200 p-4 dark:border-gray-700/60"
>
    <h2 id="format-heading" class="mb-3 text-sm font-medium">{m.leagues_format_heading()}</h2>
    <dl class="mb-4 space-y-2 text-xs">
        {#each rows as [term, description] (term)}
            <div>
                <dt class="text-gray-500 dark:text-gray-400">{term}</dt>
                <dd class="mt-0.5">{description}</dd>
            </div>
        {/each}
    </dl>
    <TournamentGameOptions config={rules.gameConfig} {configurator} />
</aside>
