<script lang="ts">
    import { EpochTrack, type HydratedFeudumGameState } from '@tabletop/feudum'
    import BoardPiece from '$lib/components/map/BoardPiece.svelte'
    import { EpochRayMarks, EpochRays, SunCentre, trackPlace } from '$lib/utils/boardGeometry.js'
    import { CatapultPath, RefillPath, SunRays } from '$lib/utils/trackShape.js'

    /**
     * R-4.11 The epoch marker on its sunray. The print has the rays and their marks; `printed` false
     * draws our own: R-4.12 each dawn's map direction, catapult and refill.
     */
    let {
        state,
        printed,
        dim
    }: {
        state: HydratedFeudumGameState
        printed: boolean
        /** Dimmed with the rest of the board: each ray and the marker as itself. */
        dim?: number
    } = $props()

    const RayReach = 150
    const MarkSize = 18
    let ray = $derived(EpochTrack.find(({ epoch }) => epoch === state.epoch))
</script>

{#if !printed}
    <g data-drawn-sky style:font-family="var(--feudum-font-title)">
        {#each EpochTrack as sunray (sunray.id)}
            {@const at = trackPlace(EpochRays, sunray.id)}
            {@const mark = trackPlace(EpochRayMarks, sunray.id)}
            <!-- Each ray's line, number and mark dim as themselves, never the ray as one group. -->
            <g>
                <line
                    stroke-opacity={dim}
                    x1={SunCentre.x}
                    y1={SunCentre.y}
                    x2={SunCentre.x +
                        ((mark.x - SunCentre.x) /
                            Math.hypot(mark.x - SunCentre.x, mark.y - SunCentre.y)) *
                            RayReach}
                    y2={SunCentre.y +
                        ((mark.y - SunCentre.y) /
                            Math.hypot(mark.x - SunCentre.x, mark.y - SunCentre.y)) *
                            RayReach}
                    stroke="var(--feudum-sky-dawn)"
                    stroke-width="5"
                    stroke-linecap="round"
                ></line>
                <text
                    opacity={dim}
                    x={at.x}
                    y={at.y + 6}
                    text-anchor="middle"
                    font-size="18"
                    fill="var(--feudum-map-ink)">{sunray.ray}</text
                >
                <g data-ray={sunray.ray} opacity={dim}>
                    {#if sunray.mapDirection}
                        <text
                            x={mark.x - 12}
                            y={mark.y + 6}
                            text-anchor="middle"
                            font-size="16"
                            fill="var(--feudum-text)">{sunray.mapDirection}</text
                        >
                    {/if}
                    {#if sunray.disloyalty}
                        <svg
                            x={mark.x + 2}
                            y={mark.y - MarkSize / 2}
                            width={MarkSize}
                            height={MarkSize}
                            viewBox="0 0 24 24"
                            data-mark="catapult"
                        >
                            <path d={CatapultPath} fill="var(--feudum-text)"></path>
                        </svg>
                    {/if}
                    {#if sunray.guildRefill}
                        <svg
                            x={mark.x + 2}
                            y={mark.y - MarkSize / 2}
                            width={MarkSize}
                            height={MarkSize}
                            viewBox="0 0 24 24"
                            data-mark="refill"
                        >
                            <path d={RefillPath} fill="var(--feudum-text)"></path>
                        </svg>
                    {/if}
                </g>
            </g>
        {/each}
    </g>
{/if}

{#if ray}
    <BoardPiece at={trackPlace(EpochRays, ray.id)} piece="epoch-marker">
        <g
            data-epoch-marker={ray.ray}
            role="img"
            aria-label="epoch marker on {ray.ray}"
            opacity={dim}
        >
            <title>Epoch {ray.ray}</title>
            {#each SunRays as angle (angle)}
                <line
                    x1="0"
                    y1="-17"
                    x2="0"
                    y2="-12"
                    transform="rotate({angle})"
                    stroke="var(--feudum-wood-dark)"
                    stroke-width="3"
                ></line>
            {/each}
            <circle
                r="12"
                fill="var(--feudum-wood-piece)"
                stroke="var(--feudum-wood-dark)"
                stroke-width="2"
            ></circle>
        </g>
    </BoardPiece>
{/if}
