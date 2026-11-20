<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import type { GhostPiece } from '$lib/model/benchView.js'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { KnightRowId } from '@tabletop/feudum'
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /** R-5-H1 A seal is the same crowned disc to all. */
    let {
        piece,
        size,
        x,
        y,
        rowPaint
    }: {
        piece: GhostPiece
        size: number
        x?: number
        y?: number
        rowPaint: (row: KnightRowId) => SeatPaint | undefined
    } = $props()

    let paint = $derived(piece.kind === 'marker' ? rowPaint(piece.row) : undefined)
</script>

{#if piece.kind === 'good'}
    <GoodToken good={piece.good} {size} {x} {y} />
{:else if piece.kind === 'vessel'}
    <VesselToken vessel={piece.vessel} {size} {x} {y} />
{:else if piece.kind === 'seal'}
    <SealFace faceShown={sealFaceShown(false)} {size} {x} {y} />
{:else if piece.kind === 'monster'}
    <MonsterToken monster={piece.monster} {size} {x} {y} />
{:else if paint}
    <SeatToken kind="marker" {paint} {size} {x} {y} />
{/if}
