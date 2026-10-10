<script lang="ts">
    import ShrimpPiece from './Shrimp.svelte'
    import LarvaCube from './LarvaCube.svelte'
    import AlgaCylinder from './AlgaCylinder.svelte'
    import { CoralTileFaceUrls, OpenSeaImageUrl } from '$lib/images/art.generated.js'
    import {
        AlgaSpace,
        coralTileSlot,
        eatenShrimpSlot,
        ImageToTable,
        larvaSpace,
        OpenSeaImage,
        OpenSeaView
    } from '$lib/utils/artGeometry.js'
    import { polypFaceUrl } from '$lib/utils/polypFaces.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)

    const LarvaPolypSize = 90
    const LarvaPolypGap = 6
    const LarvaPolypLeft = 60

    const shrimpsOnOpenSea = $derived(
        state.turnManager.turnOrder
            .map((playerId, seat) => ({ playerId, seat }))
            .filter(({ playerId }) => state.getPlayerState(playerId).shrimpOnOpenSea)
    )
</script>

<svg
    viewBox="{OpenSeaView.x} {OpenSeaView.y} {OpenSeaView.width} {OpenSeaView.height}"
    width={OpenSeaView.width * ImageToTable}
    height={OpenSeaView.height * ImageToTable}
    role="img"
    aria-label="Open sea"
>
    <image href={OpenSeaImageUrl} width={OpenSeaImage.width} height={OpenSeaImage.height}></image>

    {#each state.coralTiles as tile, index (tile.tileId)}
        {@const slot = coralTileSlot(index)}
        {@const faces = CoralTileFaceUrls[tile.tileId]}
        <image
            href={tile.starfishSideUp ? faces.starfish : faces.plain}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
        ></image>
        {#if tile.cylinder}
            <AlgaCylinder
                center={{ x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 }}
                size={56}
                color={tile.cylinder}
            />
        {/if}
    {/each}

    {#if state.openSeaAlga}
        <AlgaCylinder center={AlgaSpace} size={64} color={state.openSeaAlga} />
    {/if}

    {#each state.openSea as space (space.larvaColor)}
        {@const area = larvaSpace(space.larvaColor)}
        {#if space.hasLarvaCube}
            <LarvaCube
                center={{ x: area.x + 32, y: area.y + 150 }}
                size={44}
                color={space.larvaColor}
            />
        {/if}
        {#each space.polyps as polyp, index (index)}
            <image
                href={polypFaceUrl(
                    polyp,
                    `${gameSession.game.id}:sea:${space.larvaColor}:${index}`
                )}
                x={area.x + LarvaPolypLeft + index * (LarvaPolypSize + LarvaPolypGap)}
                y={area.y + (area.height - LarvaPolypSize) / 2 + 10}
                width={LarvaPolypSize}
                height={LarvaPolypSize}
            ></image>
        {/each}
    {/each}

    {#each shrimpsOnOpenSea as { playerId, seat } (playerId)}
        <ShrimpPiece
            center={eatenShrimpSlot(seat)}
            size={190}
            upsideDown={seat % 2 === 0}
            color={gameSession.colors.getPlayerBgColorValue(playerId)}
        />
    {/each}
</svg>
