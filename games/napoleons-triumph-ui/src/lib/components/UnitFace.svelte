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
        ink: string
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
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3"></rect>
            <circle cx={w / 2} cy={h / 2} r={h * 0.27} fill={ink}></circle>
        {:else if face.type === UnitType.Cavalry}
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3"></rect>
            <polygon points="0,0 0,{h} {w},{h}" fill={ink}></polygon>
        {:else if face.guard}
            <rect width={w} height={h} fill={ink} stroke={ink} stroke-width="1.3"></rect>
            <path d="M0 0 L{w} {h} M{w} 0 L0 {h}" stroke={ground} stroke-width="1.1"></path>
        {:else}
            <rect width={w} height={h} fill={ground} stroke={ink} stroke-width="1.3"></rect>
            <polygon points="0,0 {w / 2},{h / 2} 0,{h}" fill={ink}></polygon>
            <polygon points="{w},0 {w / 2},{h / 2} {w},{h}" fill={ink}></polygon>
        {/if}
    </g>
{/each}
