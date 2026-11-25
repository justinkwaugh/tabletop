<script lang="ts">
    import type { GameConfig, GameConfigurator } from '@tabletop/common'
    import { configuredGameOptions } from '$lib/utils/gameOptions'
    import { m } from '$lib/paraglide/messages'
    let {
        config,
        configurator,
        heading = m.tournaments_game_options(),
        seated = true
    }: {
        config: GameConfig
        configurator?: GameConfigurator
        heading?: string
        // Whether these Games assign seats; a Knockout's Decider does not.
        seated?: boolean
    } = $props()
    let options = $derived(configuredGameOptions(config, configurator ?? [], seated))
</script>

<section aria-label={heading} class="border-t border-gray-200 pt-3 dark:border-gray-700/60">
    <h2 class="mb-2 text-sm font-medium">{heading}</h2>
    {#if options.length}
        <dl class="space-y-1.5 text-xs">
            {#each options as option (option.name)}<div class="flex justify-between gap-3">
                    <dt class="text-gray-500 dark:text-gray-400">{option.name}</dt>
                    <dd class="text-right">{option.value}</dd>
                </div>{/each}
        </dl>
    {:else}<p class="text-xs text-gray-500 dark:text-gray-400">
            {m.tournaments_game_options_standard()}
        </p>{/if}
</section>
