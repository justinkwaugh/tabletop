<script lang="ts">
    import { RAILROAD_IDS } from '@tabletop/preussische-ostbahn'
    import { CARD_AREA } from '$lib/utils/boardGeometry.js'
    import RailroadCard from './RailroadCard.svelte'

    const COLUMNS = 4
    const GAP = 10
    const width = (CARD_AREA.width - (COLUMNS - 1) * GAP) / COLUMNS
    const height = (CARD_AREA.height - GAP) / 2
</script>

{#each RAILROAD_IDS as railroadId, index (railroadId)}
    <RailroadCard
        {railroadId}
        x={CARD_AREA.x + (index % COLUMNS) * (width + GAP)}
        y={CARD_AREA.y + Math.floor(index / COLUMNS) * (height + GAP)}
        {width}
        {height}
    />
{/each}
