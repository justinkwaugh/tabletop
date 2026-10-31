<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { BAG_COUNT_Y } from '$lib/utils/boardGeometry.js'
    import StripCard from './StripCard.svelte'

    let { remaining, box }: { remaining: number; box: BoundingBox } = $props()
</script>

<!-- R-1.3, R-5: the bag shows how many pieces are left, never which. -->
<g data-bag={remaining}>
    <StripCard {box} title="THE BAG">
        <text
            x={box.width / 2}
            y={BAG_COUNT_Y}
            class="pp-board-figure"
            font-size="160"
            fill="var(--pp-ink)">{remaining}</text
        >
        <text
            x={box.width / 2}
            y="300"
            class="pp-board-figure pp-board-italic"
            font-size="48"
            fill="var(--pp-ink-sub)">{remaining === 1 ? 'piece left' : 'pieces left'}</text
        >
    </StripCard>
</g>
