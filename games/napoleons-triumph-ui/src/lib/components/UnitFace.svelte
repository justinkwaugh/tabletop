<script lang="ts">
    import type { Face } from '@tabletop/napoleons-triumph'
    import { FACE_SYMBOL_GAP, faceWidth } from '$lib/utils/faceLayout.js'
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

    const LINE_WIDTH = 1.3
    const DOT_SHARE_OF_HEIGHT = 0.27

    const total = $derived(faceWidth(face.strength, symbolWidth))
    const offsets = $derived(
        Array.from(
            { length: face.strength },
            (_, index) => -total / 2 + index * (symbolWidth + FACE_SYMBOL_GAP)
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
