<script lang="ts">
    import { Spaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import { pieceKey, piecesOn, slottedPieces } from '$lib/model/mapView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { MonsterSize, PawnSize, VesselSize, spaceGeometry } from '$lib/utils/boardGeometry.js'
    import { PawnBox } from '$lib/utils/pieceShapes.js'
    import BoardPiece from './BoardPiece.svelte'
    import CountChip from './CountChip.svelte'

    /**
     * R-4.1 Pawns, pawns on their vessels (R-4.2.2), monsters with a collar when controlled (R-4.2.4).
     * Up to four sit round a space at fixed slots; more show as a count chip.
     */
    let {
        state,
        paintOf
    }: { state: HydratedFeudumGameState; paintOf: (playerId: string) => SeatPaint } = $props()

    const PawnWidth = (PawnSize * (PawnBox.width + 8)) / PawnBox.height
</script>

{#each Spaces as { id } (id)}
    {@const geometry = spaceGeometry(id)}
    {@const { shown, more } = slottedPieces(piecesOn(state, id))}
    {#each shown as piece, slot (pieceKey(piece))}
        <BoardPiece at={geometry.pieceSlots[slot]} piece={pieceKey(piece)}>
            {#if piece.kind === 'pawn'}
                {#if piece.vessel}
                    <VesselToken
                        vessel={piece.vessel}
                        size={VesselSize}
                        x={-VesselSize / 2}
                        y={PawnSize / 2 - VesselSize / 2}
                    />
                {/if}
                <PawnPiece
                    paint={paintOf(piece.playerId)}
                    character={piece.character}
                    drunk={piece.drunk}
                    size={PawnSize}
                    x={-PawnWidth / 2}
                    y={-PawnSize / 2 - (piece.vessel ? 6 : 0)}
                />
            {:else}
                <MonsterToken
                    monster={piece.monster}
                    paint={piece.playerId ? paintOf(piece.playerId) : undefined}
                    size={MonsterSize}
                    x={-MonsterSize / 2}
                    y={-MonsterSize / 2}
                />
            {/if}
        </BoardPiece>
    {/each}
    {#if more > 0}
        <CountChip count="+{more}" x={geometry.countChip.x} y={geometry.countChip.y} />
    {/if}
{/each}
