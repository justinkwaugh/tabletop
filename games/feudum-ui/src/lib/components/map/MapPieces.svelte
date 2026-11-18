<script lang="ts">
    import { Spaces, type HydratedFeudumGameState } from '@tabletop/feudum'
    import MonsterToken from '$lib/components/pieces/MonsterToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import { PlainChrome, dimmed, type BoardChrome } from '$lib/model/boardChrome.js'
    import { monsterTarget, pawnTarget, roleOf, type BoardTarget } from '$lib/model/boardOffer.js'
    import { pieceKey, type MapPiece } from '$lib/model/mapView.js'
    import { pawnPlace } from '$lib/model/cardFlows.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { PieceFrame, shownOn } from '$lib/model/spaceChips.js'
    import { MonsterSize, PawnSize, VesselSize, spaceGeometry } from '$lib/utils/boardGeometry.js'
    import BoardPiece from './BoardPiece.svelte'
    import CountChip from './CountChip.svelte'
    import PickChrome from './PickChrome.svelte'

    /**
     * R-4.1 Pawns, pawns on their vessels (R-4.2.2), monsters with a collar when controlled (R-4.2.4).
     * Up to four sit round a space at fixed slots; more show as a count chip, and a piece the offer
     * lights takes a slot first so it can be pressed (`shownOn`). Their chips stand in the chip
     * layer, in a row with the space's own (`MapChips`).
     */
    let {
        state,
        paintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
    } = $props()

    function targetOf(piece: MapPiece): BoardTarget {
        return piece.kind === 'pawn'
            ? pawnTarget(piece.playerId, piece.n)
            : monsterTarget(piece.monster)
    }
</script>

{#each Spaces as { id } (id)}
    {@const geometry = spaceGeometry(id)}
    {@const { shown, more } = shownOn(state, chrome.offer, id)}
    {#each shown as piece, slot (pieceKey(piece))}
        {@const target = targetOf(piece)}
        <BoardPiece at={geometry.pieceSlots[slot]} piece={pieceKey(piece)}>
            <g opacity={dimmed(roleOf(chrome.offer, target))}>
                {#if piece.kind === 'pawn'}
                    {#if piece.vessel}
                        <g data-rides>
                            <VesselToken
                                vessel={piece.vessel}
                                size={VesselSize}
                                x={-VesselSize / 2}
                                y={PawnSize / 2 - VesselSize / 2}
                            />
                        </g>
                    {/if}
                    <PawnPiece
                        paint={paintOf(piece.playerId)}
                        character={piece.character}
                        drunk={piece.drunk}
                        size={PawnSize}
                        x={-PawnSize / 2}
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
            </g>
        </BoardPiece>
        <PickChrome
            {target}
            {chrome}
            at={geometry.pieceSlots[slot]}
            width={PieceFrame}
            label={piece.kind === 'pawn' ? pawnPlace({ ...piece, spaceId: id }) : piece.monster}
            drawsChip={false}
        />
    {/each}
    {#if more > 0}
        <CountChip count="+{more}" x={geometry.countChip.x} y={geometry.countChip.y} />
    {/if}
{/each}
