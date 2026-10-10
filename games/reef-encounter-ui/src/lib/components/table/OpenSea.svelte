<script lang="ts">
    import { faceUp } from '@tabletop/reef-encounter'
    import Pieces from './Pieces.svelte'
    import Target from './Target.svelte'
    import { CoralTileFaceUrls, OpenSeaImageUrl } from '$lib/images/art.generated.js'
    import {
        AlgaSpace,
        coralTileSlot,
        ImageToTable,
        larvaSpace,
        OpenSeaImage,
        OpenSeaView,
        rotatedView,
        upright,
        type BoardRotation
    } from '$lib/utils/artGeometry.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { rotation }: { rotation: BoardRotation } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const drawing = $derived(rotatedView(OpenSeaView, rotation))
    const center = (box: { x: number; y: number; width: number; height: number }) => ({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    })
</script>

<svg
    viewBox="0 0 {drawing.size.width} {drawing.size.height}"
    width={drawing.size.width * ImageToTable}
    height={drawing.size.height * ImageToTable}
    role="group"
    aria-label="Open sea"
>
    <g transform={drawing.transform}>
        <image href={OpenSeaImageUrl} width={OpenSeaImage.width} height={OpenSeaImage.height}
        ></image>

        {#each state.coralTiles as tile, index (tile.tileId)}
            {@const slot = coralTileSlot(index)}
            {@const faces = CoralTileFaceUrls[tile.tileId]}
            {@const face = faceUp(tile)}
            <g
                transform={upright(rotation, center(slot))}
                role="img"
                aria-label="Coral tile {tile.tileId}: {face.stronger} beats {face.weaker}; {face.largeAlga} and {face.smallAlga} algae{tile.starfishSideUp
                    ? ', starfish side up'
                    : ''}"
            >
                <image
                    href={tile.starfishSideUp ? faces.starfish : faces.plain}
                    x={slot.x}
                    y={slot.y}
                    width={slot.width}
                    height={slot.height}
                ></image>
            </g>
        {/each}

        <Pieces container="sea" {rotation} />

        {#if gameSession.cylinderTargets.openSea}
            <Target
                box={{ x: AlgaSpace.x - 56, y: AlgaSpace.y - 56, width: 112, height: 112 }}
                label="Put the {gameSession.cylinderAlga} cylinder on the open-sea cylinder space"
                onselect={() => gameSession.playAlgaCylinder()}
            />
        {/if}
        {#each state.coralTiles as tile, index (tile.tileId)}
            {#if gameSession.cylinderTargets.tileIds.includes(tile.tileId)}
                <Target
                    box={coralTileSlot(index)}
                    label="Lock coral tile {tile.tileId} with the {gameSession.cylinderAlga} cylinder"
                    onselect={() => gameSession.playAlgaCylinder(tile.tileId)}
                />
            {/if}
        {/each}

        {#each gameSession.takeableSpaces as larvaColor (larvaColor)}
            <Target
                box={larvaSpace(larvaColor)}
                label="Take the {larvaColor} larva cube and its polyps, ending your turn"
                onselect={() => gameSession.takeOpenSeaSpace(larvaColor)}
            />
        {/each}
    </g>
</svg>
