<script lang="ts">
    import {
        EpicVoyageTrack,
        MilitaryServiceTrack,
        type HydratedFeudumGameState
    } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import PickChrome from '$lib/components/map/PickChrome.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import {
        PlainChrome,
        dimmed,
        dimmedWithRest,
        type BoardChrome
    } from '$lib/model/boardChrome.js'
    import { militaryTarget, roleOf, voyageTarget } from '$lib/model/boardOffer.js'
    import { serviceDiscs, voyageDiscs } from '$lib/model/boardView.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import {
        ServiceFanStep,
        ServiceSpaces,
        TrackDiscSize,
        VoyageFanStep,
        VoyageSpaces,
        fanOffset,
        trackPlace
    } from '$lib/utils/boardGeometry.js'
    import { WritPath } from '$lib/utils/trackShape.js'

    /**
     * R-3.7.5 Each seat's voyage disc; R-4.9-H2 its discs on the military service spaces it covered.
     * The print has both tracks; `printed` false draws our own spaces with their values from the data.
     */
    let {
        state,
        printed,
        paintOf,
        chrome = PlainChrome
    }: {
        state: HydratedFeudumGameState
        printed: boolean
        paintOf: (playerId: string) => SeatPaint
        chrome?: BoardChrome
    } = $props()

    const SpaceRadius = 16
    const VoyageRing = SpaceRadius * 2 + 10
    const ServiceRing = { width: 92, height: 38 }

    function voyageRole(spaceId: string) {
        const number = EpicVoyageTrack.find(({ id }) => id === spaceId)?.space
        return number === undefined ? 'plain' : roleOf(chrome.offer, voyageTarget(number))
    }

    function serviceRole(spaceId: string) {
        const number = MilitaryServiceTrack.find(({ id }) => id === spaceId)?.space
        return number === undefined ? 'plain' : roleOf(chrome.offer, militaryTarget(number))
    }
</script>

{#if !printed}
    <!-- Each drawn space dims as itself: the tracks round the board never fade as one group. -->
    <g data-drawn-tracks style:font-family="var(--feudum-font-text)">
        {#each EpicVoyageTrack as space (space.id)}
            {@const at = trackPlace(VoyageSpaces, space.id)}
            <g opacity={dimmedWithRest(chrome)}>
                <circle
                    cx={at.x}
                    cy={at.y}
                    r={SpaceRadius}
                    fill="var(--feudum-parchment)"
                    stroke="var(--feudum-map-ink)"
                ></circle>
                <text
                    x={at.x}
                    y={at.y + 5}
                    text-anchor="middle"
                    font-size="14"
                    fill="var(--feudum-ink)">{space.space}</text
                >
                {#if space.writDraw}
                    <svg
                        x={at.x - 8}
                        y={at.y - SpaceRadius - 18}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        data-writ-icon={space.space}
                    >
                        <path
                            d={WritPath}
                            fill="var(--feudum-parchment)"
                            stroke="var(--feudum-map-ink)"
                            stroke-width="1.5"
                        ></path>
                    </svg>
                {/if}
            </g>
        {/each}
        {#each MilitaryServiceTrack as space (space.id)}
            {@const at = trackPlace(ServiceSpaces, space.id)}
            <g opacity={dimmedWithRest(chrome)}>
                <ellipse
                    cx={at.x}
                    cy={at.y}
                    rx="40"
                    ry="14"
                    fill="var(--feudum-parchment)"
                    stroke="var(--feudum-map-ink)"
                ></ellipse>
                <text
                    x={at.x}
                    y={at.y + 5}
                    text-anchor="middle"
                    font-size="14"
                    fill="var(--feudum-ink)">{space.penalty}</text
                >
            </g>
        {/each}
    </g>
{/if}

{#each voyageDiscs(state) as disc (disc.key)}
    {@const at = trackPlace(VoyageSpaces, disc.spaceId)}
    <g opacity={dimmed(voyageRole(disc.spaceId))}>
        <BoardPiece
            at={{ x: at.x + fanOffset(disc.index, disc.count, VoyageFanStep), y: at.y }}
            piece={disc.key}
        >
            <SeatToken
                kind="disc"
                paint={paintOf(disc.playerId)}
                size={TrackDiscSize}
                x={-TrackDiscSize / 2}
                y={-TrackDiscSize / 2}
            />
        </BoardPiece>
    </g>
{/each}
{#each serviceDiscs(state) as disc (disc.key)}
    {@const at = trackPlace(ServiceSpaces, disc.spaceId)}
    <g opacity={dimmed(serviceRole(disc.spaceId))}>
        <BoardPiece
            at={{ x: at.x + fanOffset(disc.index, disc.count, ServiceFanStep), y: at.y }}
            piece={disc.key}
        >
            <SeatToken
                kind="disc"
                paint={paintOf(disc.playerId)}
                size={TrackDiscSize}
                x={-TrackDiscSize / 2}
                y={-TrackDiscSize / 2}
            />
        </BoardPiece>
    </g>
{/each}
{#each EpicVoyageTrack as space (space.id)}
    <PickChrome
        target={voyageTarget(space.space)}
        {chrome}
        at={trackPlace(VoyageSpaces, space.id)}
        width={VoyageRing}
        label="Voyage {space.space}"
    />
{/each}
{#each MilitaryServiceTrack as space (space.id)}
    <PickChrome
        target={militaryTarget(space.space)}
        {chrome}
        at={trackPlace(ServiceSpaces, space.id)}
        width={ServiceRing.width}
        height={ServiceRing.height}
        label="Military service {space.space}"
    />
{/each}
