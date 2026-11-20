<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        RegionTiles,
        Spaces,
        type HydratedFeudumGameState,
        type SpaceId,
        type TileId
    } from '@tabletop/feudum'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import TileFace from '$lib/components/pieces/TileFace.svelte'
    import Enlargeable from '$lib/components/table/Enlargeable.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import {
        PlainChrome,
        dimmed,
        dimmedUnlessAny,
        isPickable,
        pilferPlace,
        pilfersAt,
        type BoardChrome
    } from '$lib/model/boardChrome.js'
    import { markerTarget, roleOf, spaceTarget, feudumTarget } from '$lib/model/boardOffer.js'
    import { spaceLabel } from '$lib/model/cardFlows.js'
    import { abandonedVessels, goodKinds } from '$lib/model/mapView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        ImmunitySealSize,
        LandscapeSize,
        MarkerSize,
        PlateGood,
        VesselSize,
        plateBox,
        plateSlot,
        spaceGeometry
    } from '$lib/utils/boardGeometry.js'
    import BoardPiece from './BoardPiece.svelte'
    import CountChip from './CountChip.svelte'
    import PickChrome from './PickChrome.svelte'

    /** R-1.1, R-4.1.2, R-3.14.2, R-3.7.4: goods, markers, immunity seals and pilfer targets. */
    let {
        state,
        paintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
    } = $props()

    const PilferFrame = 40
    const MarkerFrame = MarkerSize + 10

    function epochOf(tileId: TileId) {
        return RegionTiles.find(({ id }) => id === tileId)?.epoch ?? 1
    }
</script>

{#snippet marker(spaceId: SpaceId, role: string, at: Point, playerId: string, immune: boolean)}
    {@const target = markerTarget(spaceId, playerId, role)}
    <BoardPiece {at} piece="marker:{spaceId}:{role}">
        <g opacity={dimmed(roleOf(chrome.offer, target))}>
            {#if immune}
                <g data-immune>
                    <SealFace
                        faceShown={false}
                        size={ImmunitySealSize}
                        x={-ImmunitySealSize / 2}
                        y={MarkerSize / 2 - ImmunitySealSize / 2}
                    />
                </g>
            {/if}
            <g data-role={role}>
                <SeatToken
                    kind="marker"
                    paint={paintOf(playerId)}
                    size={MarkerSize}
                    x={-MarkerSize / 2}
                    y={-MarkerSize / 2}
                />
            </g>
        </g>
    </BoardPiece>
    <PickChrome
        {target}
        {chrome}
        {at}
        width={MarkerFrame}
        label="{role} at {spaceLabel(spaceId)}"
    />
{/snippet}

{#each Spaces as { id } (id)}
    {@const space = state.spaces[id]}
    {@const geometry = spaceGeometry(id)}
    {@const pilfers = pilfersAt(chrome.offer, id)}
    {@const lit = [spaceTarget(id), feudumTarget(id)]}
    {@const kinds = goodKinds(space.goods)}
    {@const dim = dimmedUnlessAny(chrome, [...lit, ...pilfers])}
    {#if space.landscape}
        {@const tileId = space.landscape.tileId}
        <BoardPiece at={geometry.landscape} piece="landscape:{id}">
            <g opacity={dim}>
                <Enlargeable
                    label="landscape tile"
                    off={lit.some((target) => isPickable(roleOf(chrome.offer, target)))}
                    face={() => ({
                        kind: 'tile',
                        faceShown: true,
                        epoch: epochOf(tileId),
                        landscape: state.tileLandscapes[tileId]
                    })}
                >
                    <TileFace
                        faceShown={true}
                        epoch={epochOf(tileId)}
                        landscape={state.tileLandscapes[tileId]}
                        size={LandscapeSize}
                        x={-LandscapeSize / 2}
                        y={-LandscapeSize / 2}
                    />
                </Enlargeable>
                {#if space.landscape.amount > 0}
                    <CountChip
                        count={space.landscape.amount}
                        x={LandscapeSize / 2}
                        y={LandscapeSize / 2}
                    />
                {/if}
            </g>
        </BoardPiece>
    {/if}
    {#if kinds.length > 0}
        {@const plate = plateBox(geometry.plate, kinds.length)}
        {@const shown = dim ?? 1}
        <g data-goods-plate={id}>
            <rect
                {...plate}
                y={plate.y + 2}
                rx="8"
                fill="var(--feudum-map-ink)"
                fill-opacity={0.55 * shown}
            ></rect>
            <rect
                {...plate}
                rx="8"
                fill="var(--feudum-parchment)"
                fill-opacity={shown}
                stroke="var(--feudum-ink)"
                stroke-opacity={shown}
                stroke-width="2.5"
            ></rect>
        </g>
    {/if}
    {#each kinds as { good, count }, slot (good)}
        <BoardPiece at={plateSlot(geometry.plate, slot)} piece="good:{id}:{good}">
            <g opacity={dim}>
                <GoodToken
                    {good}
                    size={PlateGood.size}
                    x={-PlateGood.size / 2}
                    y={-PlateGood.size / 2}
                />
                {#if count > 1}
                    <g
                        transform="translate(12 -13)"
                        role="img"
                        aria-label="{count} {good}"
                        data-good-count
                    >
                        <circle
                            r="9.5"
                            fill="var(--feudum-halo)"
                            stroke="var(--feudum-accent)"
                            stroke-width="1.6"
                        ></circle>
                        <text
                            y="4.6"
                            text-anchor="middle"
                            font-size="13.5"
                            font-weight="700"
                            fill="var(--feudum-text)">{count}</text
                        >
                    </g>
                {/if}
            </g>
        </BoardPiece>
    {/each}
    {#each abandonedVessels(space.vessels) as { vessel, count } (vessel)}
        <BoardPiece at={geometry.vessels[vessel]} piece="vessel:{id}:{vessel}">
            <g opacity={dim}>
                <VesselToken
                    {vessel}
                    size={VesselSize}
                    x={-VesselSize / 2}
                    y={(-VesselSize * 2) / 6}
                />
                {#if count > 1}
                    <CountChip {count} x={VesselSize / 2} y={VesselSize / 3} />
                {/if}
            </g>
        </BoardPiece>
    {/each}
    {#if space.ruler}
        {@render marker(id, 'ruler', geometry.ruler, space.ruler.playerId, false)}
        {#if space.ruler.subject}
            {@render marker(
                id,
                'subject',
                geometry.subject,
                space.ruler.playerId,
                space.ruler.subjectImmune === true
            )}
        {/if}
    {/if}
    {#if space.serf}
        {@render marker(id, 'serf', geometry.serf, space.serf.playerId, space.serf.immune === true)}
    {/if}
    {#each pilfers as target, index (target)}
        <PickChrome
            {target}
            {chrome}
            at={pilferPlace(geometry.centre, index, pilfers.length)}
            width={PilferFrame}
            label={target.split(':').at(-1) ?? target}
        />
    {/each}
{/each}
