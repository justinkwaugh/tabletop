<script lang="ts">
    import type { PieceKind } from '@tabletop/tzaar'
    import { PIECE_RADIUS, stackBounds } from '$lib/board/pieceGeometry.js'
    import type { Tone } from '$lib/board/pieceStyle.js'
    import PieceDefs from './PieceDefs.svelte'
    import StackShape from './StackShape.svelte'

    // One piece of a type, standing on the table as on the board.
    let { tone, kind, size = 28 }: { tone: Tone; kind: PieceKind; size?: number } = $props()

    const uid = $props.id()
    const prefix = $derived(`tzaar-icon-${uid}`)
    const bounds = stackBounds(1, PIECE_RADIUS)
    const width = PIECE_RADIUS * 2 + 2
    const height = bounds.bottom - bounds.top + 2
</script>

<svg
    viewBox="{-width / 2} {bounds.top - 1} {width} {height}"
    width={size}
    height={(size * height) / width}
    aria-hidden="true"
    class="inline-block"
>
    <defs><PieceDefs {prefix} tones={[tone]} /></defs>
    <StackShape {prefix} pieces={[{ tone, kind, seedKey: `icon-${kind}` }]} radius={PIECE_RADIUS} />
</svg>
