<script lang="ts">
    import ShrimpPiece from './Shrimp.svelte'
    import LarvaCube from './LarvaCube.svelte'
    import AlgaCylinder from './AlgaCylinder.svelte'
    import { ShrimpLength, upright, type BoardRotation } from '$lib/utils/artGeometry.js'
    import type { PieceContainer } from '$lib/utils/tablePieces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { container, rotation }: { container: PieceContainer; rotation: BoardRotation } = $props()

    const gameSession = getGameSession()
    const pieces = $derived(
        gameSession.tablePieces.filter((piece) => piece.container === container)
    )
</script>

<!-- The outer group of each piece belongs to the animator; the inner one places it. Pieces
     stand upright on the turned drawing, except polyps, which are square, and the shrimps eaten
     onto the open sea, which lie on their printed silhouettes. -->
{#each pieces as piece (piece.key)}
    <g {@attach gameSession.piecesAnimator.attach(piece.key)}>
        {#if piece.kind === 'polyp'}
            <image
                href={piece.url}
                x={piece.box.x}
                y={piece.box.y}
                width={piece.box.width}
                height={piece.box.height}
            ></image>
            {#if piece.larvaSpace}
                <rect
                    x={piece.box.x}
                    y={piece.box.y}
                    width={piece.box.width}
                    height={piece.box.height}
                    fill="none"
                    stroke="rgb(0 0 0 / 0.45)"
                    stroke-width="2"
                ></rect>
            {/if}
        {:else if piece.kind === 'shrimp'}
            <g transform={piece.container === 'sea' ? undefined : upright(rotation, piece.center)}>
                <ShrimpPiece
                    center={piece.center}
                    length={ShrimpLength}
                    upsideDown={piece.upsideDown}
                    blinkSeed={piece.key}
                    color={gameSession.colors.getPlayerBgColorValue(piece.playerId)}
                />
            </g>
        {:else if piece.kind === 'cube'}
            <g transform={upright(rotation, piece.center)}>
                <LarvaCube center={piece.center} size={44} color={piece.color} />
            </g>
        {:else}
            <g transform={upright(rotation, piece.center)}>
                <AlgaCylinder center={piece.center} size={piece.size} color={piece.color} />
            </g>
        {/if}
    </g>
{/each}
