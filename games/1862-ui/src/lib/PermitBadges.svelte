<script lang="ts">
    import type { TrainKind } from '@tabletop/1862'
    let { kinds, size = 16 }: { kinds: readonly TrainKind[]; size?: number } = $props()
    // The train cards' marks: Express a red circle, Local a blue diamond, Freight a purple
    // hexagon (§2.2).
    const names: Record<TrainKind, string> = {
        express: 'Express',
        local: 'Local',
        freight: 'Freight'
    }
</script>

<span class="permits" aria-label={`Permits: ${kinds.map((kind) => names[kind]).join(', ')}`}>
    {#each kinds as kind (kind)}
        <svg width={size} height={size} viewBox="-10 -10 20 20" role="img" aria-label={names[kind]}>
            <title>{names[kind]} permit</title>
            {#if kind === 'express'}
                <circle r="9" fill="#c8312b"></circle>
            {:else if kind === 'local'}
                <polygon points="0,-9.5 9.5,0 0,9.5 -9.5,0" fill="#2f6db5"></polygon>
            {:else}
                <polygon points="-9,0 -4.5,-8 4.5,-8 9,0 4.5,8 -4.5,8" fill="#6d3f97"></polygon>
            {/if}
            <text y="3.6" text-anchor="middle" font-size="10" font-weight="700" fill="#fff"
                >{names[kind][0]}</text
            >
        </svg>
    {/each}
</span>

<style>
    .permits {
        display: inline-flex;
        gap: 3px;
        vertical-align: middle;
    }
</style>
