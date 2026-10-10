<script lang="ts">
    import { UnitType, type Face } from '@tabletop/napoleons-triumph'

    let {
        face,
        ink,
        ground,
        symbolWidth = 17,
        symbolHeight = 12
    }: {
        face: Face
        /** Colour of the printed symbol. */
        ink: string
        /** Colour of the block the symbol is printed on. */
        ground: string
        symbolWidth?: number
        symbolHeight?: number
    } = $props()

    const GAP = 3
    const w = $derived(symbolWidth)
    const h = $derived(symbolHeight)
    const total = $derived(face.strength * w + (face.strength - 1) * GAP)
    const offsets = $derived(
        Array.from({ length: face.strength }, (_, index) => -total / 2 + index * (w + GAP))
    )
</script>

{#each offsets as x (x)}
    <g transform="translate({x} {-h / 2})">
        {#if face.type === UnitType.Artillery}
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3" />
            <circle cx={w / 2} cy={h / 2} r={h * 0.27} fill={ink} />
        {:else if face.type === UnitType.Cavalry}
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3" />
            <polygon points="0,0 0,{h} {w},{h}" fill={ink} />
        {:else if face.guard}
            <rect width={w} height={h} fill={ink} stroke={ink} stroke-width="1.3" />
            <path d="M0 0 L{w} {h} M{w} 0 L0 {h}" stroke={ground} stroke-width="1.1" />
        {:else}
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3" />
            <polygon points="0,0 {w / 2},{h / 2} 0,{h}" fill={ink} />
            <polygon points="{w},0 {w / 2},{h / 2} {w},{h}" fill={ink} />
        {/if}
    </g>
{/each}
