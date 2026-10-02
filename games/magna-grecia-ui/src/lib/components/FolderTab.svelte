<script lang="ts">
    import type { Snippet } from 'svelte'

    const CORNER_RADIUS = 22
    const SLOPE_WIDTH = 80

    let { side, label, children }: { side: 'left' | 'right'; label: string; children: Snippet } =
        $props()

    let width = $state(0)
    let height = $state(0)

    const r = CORNER_RADIUS
    const s = SLOPE_WIDTH
    const outline = $derived.by(() => {
        if (width === 0) {
            return undefined
        }
        const w = width
        const h = height
        return side === 'left'
            ? `path('M 0 ${h} V ${r} A ${r} ${r} 0 0 1 ${r} 0 H ${w - s} C ${w - s / 2} 0 ${w - s / 2} ${h} ${w} ${h} Z')`
            : `path('M 0 ${h} C ${s / 2} ${h} ${s / 2} 0 ${s} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h} Z')`
    })
</script>

<section
    class="folder-tab {side}"
    aria-label={label}
    style:padding-left="{side === 'left' ? 28 : SLOPE_WIDTH}px"
    style:padding-right="{side === 'left' ? SLOPE_WIDTH : 28}px"
    style:clip-path={outline}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
>
    {@render children()}
</section>

<style>
    .folder-tab {
        display: flex;
        align-items: center;
        gap: 28px;
        height: var(--tab-height);
        margin-bottom: -1px;
        background: var(--sheet-color);
        color: #4a2c12;
        font-family: 'Libre Baskerville', Georgia, serif;
        white-space: nowrap;
    }

    .folder-tab.left {
        background:
            radial-gradient(
                var(--sheet-light-size) at var(--sheet-light-x)
                    calc(var(--sheet-light-y) + var(--tab-height) - 1px),
                rgba(255, 255, 255, 0.35),
                transparent 60%
            ),
            var(--sheet-color);
    }
</style>
