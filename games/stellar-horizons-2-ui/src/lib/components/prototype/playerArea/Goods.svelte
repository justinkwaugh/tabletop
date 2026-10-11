<script lang="ts">
    // PROTOTYPE: trade goods as their triangular counters, with empty outlines up to capacity.
    import { GOODS_COLORS } from './campaignMock.svelte.js'

    let {
        goods,
        capacity = 0,
        size = 16
    }: { goods: string[]; capacity?: number; size?: number } = $props()
    const empty = $derived(Math.max(0, capacity - goods.length))
</script>

<span class="goods">
    {#each goods as good, index (index)}
        <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={good}>
            <title>{good}</title>
            <path
                d="M10 2.5 L18 16.5 Q18 17.5 17 17.5 L3 17.5 Q2 17.5 2 16.5 Z"
                fill={GOODS_COLORS[good] ?? '#ccc'}
                stroke="rgba(0,0,0,0.6)"
                stroke-width="1"
                stroke-linejoin="round"
            ></path>
            <text x="10" y="15.5" text-anchor="middle">{good.slice(0, 1)}</text>
        </svg>
    {/each}
    {#each { length: empty } as _, index (index)}
        <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
            <path
                d="M10 2.5 L18 16.5 Q18 17.5 17 17.5 L3 17.5 Q2 17.5 2 16.5 Z"
                fill="none"
                stroke="#33415c"
                stroke-width="1.2"
                stroke-linejoin="round"
            ></path>
        </svg>
    {/each}
</span>

<style>
    .goods {
        display: inline-flex;
        align-items: center;
        gap: 1px;
    }
    svg {
        display: block;
    }
    text {
        font-size: 8.5px;
        font-weight: 800;
        fill: #1b1420;
    }
</style>
