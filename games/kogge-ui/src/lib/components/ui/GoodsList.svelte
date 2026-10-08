<script lang="ts">
    import { GOODS, type GoodCounts } from '@tabletop/kogge'
    import CubeIcon from './CubeIcon.svelte'

    let { goods, emptyText = 'nothing' }: { goods: GoodCounts; emptyText?: string } = $props()
    const shown = $derived(GOODS.filter((good) => goods[good] > 0))
</script>

{#if shown.length === 0}
    <span class="italic opacity-70">{emptyText}</span>
{:else}
    <span class="inline-flex flex-wrap items-center gap-x-2 align-middle">
        {#each shown as good (good)}
            <span class="inline-flex items-center gap-0.5"><CubeIcon {good} />{goods[good]}</span>
        {/each}
    </span>
{/if}
