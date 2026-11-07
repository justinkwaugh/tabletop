<script lang="ts">
    import type { Good } from '@tabletop/feudum'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'

    /** R-1.4.8 The haversack's counts, for the seats that watch the choice. */
    let { counts }: { counts: readonly { readonly good: Good; readonly count: number }[] } =
        $props()

    const TokenSize = 18
</script>

<div class="flex flex-wrap items-center gap-3" data-haversack-counts>
    {#each counts as { good, count } (good)}
        <span class="inline-flex items-center gap-1 text-sm" data-good-count={good}>
            <GoodToken {good} size={TokenSize} />
            {count}
        </span>
    {/each}
</div>
