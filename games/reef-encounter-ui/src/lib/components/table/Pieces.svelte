<script lang="ts">
    import ShrimpPiece from './Shrimp.svelte'
    import LarvaCube from './LarvaCube.svelte'
    import AlgaCylinder from './AlgaCylinder.svelte'
    import { ShrimpLength, upright, type BoardRotation } from '$lib/utils/artGeometry.js'
    import type { PieceContainer, TablePiece } from '$lib/utils/tablePieces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { container, rotation }: { container: PieceContainer; rotation: BoardRotation } = $props()

    const gameSession = getGameSession()
    const pieces = $derived(
        gameSession.tablePieces.filter((piece) => piece.container === container)
    )

    function label(piece: TablePiece): string {
        switch (piece.kind) {
            case 'polyp':
                return `${piece.color} polyp ${piece.place}`
            case 'shrimp':
                return `${gameSession.getPlayerName(piece.playerId)}'s shrimp ${piece.place}`
            case 'cube':
                return `${piece.color} larva cube ${piece.place}`
            case 'cylinder':
                return `${piece.color} alga cylinder ${piece.place}`
            case 'coralTile': {
                const { stronger, weaker, largeAlga, smallAlga } = piece.face
                const starfish = piece.starfishSideUp ? ', starfish side up' : ''
                return `Coral tile ${piece.tileId}: ${stronger} beats ${weaker}; ${largeAlga} and ${smallAlga} algae${starfish}`
            }
        }
    }
</script>

<!-- GSAP owns each outer group's transform; the inner one places the piece. -->
{#each pieces as piece (piece.key)}
    <g {@attach gameSession.piecesAnimator.attach(piece.key)} role="img" aria-label={label(piece)}>
        {#if piece.kind === 'coralTile'}
            <image
                href={piece.url}
                x={piece.box.x}
                y={piece.box.y}
                width={piece.box.width}
                height={piece.box.height}
                transform={upright(rotation, piece.center)}
            ></image>
        {:else if piece.kind === 'polyp'}
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
