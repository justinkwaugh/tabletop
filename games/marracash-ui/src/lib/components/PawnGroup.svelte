<script lang="ts">
    import type { MarketColor } from '@tabletop/marracash'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { HistoryPawnHeight } from '$lib/utils/pawnShape.js'

    let {
        colors,
        height = HistoryPawnHeight
    }: { colors: readonly MarketColor[]; height?: number } = $props()
</script>

<span class="inline-flex items-center whitespace-nowrap align-middle">
    {#each colors as color, index (index)}
        <PawnIcon {color} {height} />
    {/each}
    <span class="sr-only"
        >{colors.length} visitor{colors.length === 1 ? '' : 's'}: {colors.join(', ')}</span
    >
</span>
