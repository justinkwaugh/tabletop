<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import UnitSymbol from './UnitSymbol.svelte'

    let {
        face,
        ink,
        ground,
        symbolWidth,
        symbolHeight
    }: {
        face: Face
        ink: string
        ground: string
        symbolWidth: number
        symbolHeight: number
    } = $props()

    const GAP = 3
    const LINE_WIDTH = 1.3
    const DOT_SHARE_OF_HEIGHT = 0.27

    const total = $derived(face.strength * symbolWidth + (face.strength - 1) * GAP)
    const offsets = $derived(
        Array.from(
            { length: face.strength },
            (_, index) => -total / 2 + index * (symbolWidth + GAP)
        )
    )
</script>

{#each offsets as x (x)}
    <g transform="translate({x} {-symbolHeight / 2})">
        <UnitSymbol
            type={face.type}
            width={symbolWidth}
            height={symbolHeight}
            {ink}
            {ground}
            lineWidth={LINE_WIDTH}
            dotRadius={symbolHeight * DOT_SHARE_OF_HEIGHT}
            solid
            guard={face.guard === true}
        />
    </g>
{/each}
