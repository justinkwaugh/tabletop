<script lang="ts">
    import type { GameConfigurator, League } from '@tabletop/common'
    import { leagueShapeText } from '$lib/utils/leaguePresentation'
    import TournamentGameOptions from '../tournaments/TournamentGameOptions.svelte'

    let {
        league,
        titleName,
        configurator
    }: { league: League; titleName: string; configurator?: GameConfigurator } = $props()
    let rules = $derived(league.rules)
    let rows = $derived([
        ['Game', titleName],
        [
            'Shape',
            `${leagueShapeText(league.shape)}: ${
                league.shape === 'pyramid'
                    ? 'group winners go up, the bottom two go down'
                    : 'the top two go up, the bottom two go down'
            }`
        ],
        [
            'Groups',
            `${rules.sizes.groupSize} players; ${rules.sizes.bottomMinimum} to ${rules.sizes.bottomMaximum} in the bottom level`
        ],
        ['Games', `${rules.gamesPerEntrant} each, ${rules.tableSize} players per game`],
        ['At once', `Up to ${rules.concurrency} games`],
        [
            'Between seasons',
            league.signUp.opensAutomatically
                ? `${league.signUp.days}-day sign-up, opened automatically`
                : `${league.signUp.days}-day sign-up, opened by an administrator`
        ]
    ])
</script>

<aside
    aria-labelledby="format-heading"
    class="rounded-lg border border-gray-200 p-4 dark:border-gray-700/60"
>
    <h2 id="format-heading" class="mb-3 text-sm font-medium">Format</h2>
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
