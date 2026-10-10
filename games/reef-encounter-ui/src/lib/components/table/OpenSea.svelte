<script lang="ts">
    import ShrimpPiece from './Shrimp.svelte'
    import LarvaCube from './LarvaCube.svelte'
    import AlgaCylinder from './AlgaCylinder.svelte'
    import Target from './Target.svelte'
    import { CoralTileFaceUrls, OpenSeaImageUrl } from '$lib/images/art.generated.js'
    import {
        AlgaSpace,
        coralTileSlot,
        eatenShrimpSlot,
        ImageToTable,
        larvaSpace,
        larvaSpaceCube,
        larvaSpacePolyp,
        OpenSeaImage,
        OpenSeaView,
        rotatedView,
        upright,
        type BoardRotation
    } from '$lib/utils/artGeometry.js'
    import { polypFaceUrl } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { rotation }: { rotation: BoardRotation } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const drawing = $derived(rotatedView(OpenSeaView, rotation))
    const center = (box: { x: number; y: number; width: number; height: number }) => ({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    })

    const shrimpsOnOpenSea = $derived(
        state.turnManager.turnOrder
            .map((playerId, seat) => ({ playerId, seat }))
            .filter(({ playerId }) => state.getPlayerState(playerId).shrimpOnOpenSea)
    )
</script>

<svg
    viewBox="0 0 {drawing.size.width} {drawing.size.height}"
    width={drawing.size.width * ImageToTable}
    height={drawing.size.height * ImageToTable}
    role="img"
    aria-label="Open sea"
>
    <g transform={drawing.transform}>
        <image href={OpenSeaImageUrl} width={OpenSeaImage.width} height={OpenSeaImage.height}
        ></image>

        {#each state.coralTiles as tile, index (tile.tileId)}
            {@const slot = coralTileSlot(index)}
            {@const faces = CoralTileFaceUrls[tile.tileId]}
            <g transform={upright(rotation, center(slot))}>
                <image
                    href={tile.starfishSideUp ? faces.starfish : faces.plain}
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                ></image>
                {#if tile.cylinder}
                    <AlgaCylinder center={center(slot)} size={56} color={tile.cylinder} />
                {/if}
            </g>
        {/each}

        {#if state.openSeaAlga}
            <g transform={upright(rotation, AlgaSpace)}>
                <AlgaCylinder center={AlgaSpace} size={64} color={state.openSeaAlga} />
            </g>
        {/if}

        {#each state.openSea as space (space.larvaColor)}
            {#if space.hasLarvaCube}
                {@const cube = larvaSpaceCube(space.larvaColor)}
                <g transform={upright(rotation, cube)}>
                    <LarvaCube center={cube} size={44} color={space.larvaColor} />
                </g>
            {/if}
            {#each space.polyps as polyp, index (index)}
                {@const tile = larvaSpacePolyp(space.larvaColor, index, space.polyps.length)}
                <image
                    href={polypFaceUrl(
                        polyp,
                        `${gameSession.game.id}:sea:${space.larvaColor}:${index}`
                    )}
                    x={tile.x}
                    y={tile.y}
                    width={tile.width}
                    height={tile.height}
                ></image>
                <rect
                    x={tile.x}
                    y={tile.y}
                    width={tile.width}
                    height={tile.height}
                    fill="none"
                    stroke="rgb(0 0 0 / 0.45)"
                    stroke-width="2"
                ></rect>
            {/each}
        {/each}

        {#each gameSession.takeableSpaces as larvaColor (larvaColor)}
            <Target
                box={larvaSpace(larvaColor)}
                label="Take the {larvaColor} larva cube and its polyps, ending your turn"
                onselect={() => gameSession.takeOpenSeaSpace(larvaColor)}
            />
        {/each}

        {#each shrimpsOnOpenSea as { playerId, seat } (playerId)}
            <ShrimpPiece
                center={eatenShrimpSlot(seat)}
                size={190}
                upsideDown={seat % 2 === 0}
                color={gameSession.colors.getPlayerBgColorValue(playerId)}
            />
        {/each}
    </g>
</svg>
