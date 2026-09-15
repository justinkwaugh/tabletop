<script lang="ts">
    import type { GameConfig, GameConfigOptions } from '@tabletop/common'
    import { configuredGameOptions } from '$lib/utils/gameOptions'
    let { config, definitions = [] }: { config: GameConfig; definitions?: GameConfigOptions } =
        $props()
    let options = $derived(configuredGameOptions(config, definitions))
</script>

<section
    aria-label="Configured game options"
    class="border-t border-gray-200 pt-3 dark:border-gray-700/60"
>
    <h2 class="mb-2 text-sm font-medium">Game options</h2>
    {#if options.length}
        <dl class="space-y-1.5 text-xs">
            {#each options as option (option.name)}<div class="flex justify-between gap-3">
                    <dt class="text-gray-500 dark:text-gray-400">{option.name}</dt>
                    <dd class="text-right">{option.value}</dd>
                </div>{/each}
        </dl>
    {:else}<p class="text-xs text-gray-500 dark:text-gray-400">
            Standard game. No configurable options.
        </p>{/if}
</section>
