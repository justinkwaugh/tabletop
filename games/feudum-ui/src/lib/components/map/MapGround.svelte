<script lang="ts">
    import { RegionIds } from '@tabletop/feudum'
    import { MapAsset, assetUrl } from '$lib/art/assetMap.js'
    import PieceFrame from '$lib/components/pieces/PieceFrame.svelte'
    import {
        MapArea,
        MapViewBox,
        RegionLabels,
        RegionOutlines,
        RiverPaths,
        SkyBottom,
        outlineD
    } from '$lib/utils/boardGeometry.js'

    /**
     * The map's ground: the printed map when its file is there, else our own terrain. Each region is
     * a fill in its token with one hatching motif, drawn once in the defs and repeated.
     */
    const Painted = ['sea', 'island', 'desert', 'forest', 'badlands', 'mountain'] as const
</script>

<PieceFrame
    label="The map"
    url={assetUrl(MapAsset)}
    width={MapArea.width}
    height={MapArea.height}
    viewBox={MapViewBox}
    x={MapArea.x}
    y={MapArea.y}
>
    <defs>
        <linearGradient id="feudum-sky" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="var(--feudum-sky-dusk)"></stop>
            <stop offset="0.5" stop-color="var(--feudum-sky-dawn)"></stop>
            <stop offset="1" stop-color="var(--feudum-sky-dusk)"></stop>
        </linearGradient>
        <pattern
            id="feudum-hatch-sea"
            width="44"
            height="26"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M2 13 Q8 7 14 13 T26 13" fill="none" stroke-width="1.5"></path>
        </pattern>
        <pattern
            id="feudum-hatch-island"
            width="52"
            height="40"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M4 26 Q16 8 28 26" fill="none" stroke-width="1.5"></path>
        </pattern>
        <pattern
            id="feudum-hatch-forest"
            width="40"
            height="44"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M14 8 L22 24 L6 24 Z M14 24 L14 30" fill="none" stroke-width="1.5"></path>
        </pattern>
        <pattern
            id="feudum-hatch-desert"
            width="72"
            height="34"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M4 22 Q22 8 40 22 T68 22" fill="none" stroke-width="1.2"></path>
        </pattern>
        <pattern
            id="feudum-hatch-badlands"
            width="46"
            height="46"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M6 10 L18 18 L14 30 M18 18 L32 14 L38 24" fill="none" stroke-width="1.5"
            ></path>
        </pattern>
        <pattern
            id="feudum-hatch-mountain"
            width="54"
            height="46"
            patternUnits="userSpaceOnUse"
            stroke="var(--feudum-terrain-line)"
            stroke-opacity="0.35"
        >
            <path d="M6 34 L20 10 L34 34 M20 10 L24 22" fill="none" stroke-width="1.5"></path>
        </pattern>
    </defs>
    <rect
        x={MapArea.x}
        y={MapArea.y}
        width={MapArea.width}
        height={SkyBottom - MapArea.y + 40}
        fill="url(#feudum-sky)"
    ></rect>
    <rect
        x={MapArea.x}
        y={SkyBottom}
        width={MapArea.width}
        height={MapArea.y + MapArea.height - SkyBottom}
        fill="var(--feudum-terrain-sea)"
    ></rect>
    {#each Painted as region (region)}
        {#each RegionOutlines[region] as outline, index (index)}
            <path d={outlineD(outline)} fill="var(--feudum-terrain-{region})"></path>
            <path
                d={outlineD(outline)}
                fill="url(#feudum-hatch-{region})"
                stroke="var(--feudum-terrain-line)"
                stroke-opacity="0.35"
                stroke-width="2"
                data-terrain={region}
            ></path>
        {/each}
    {/each}
    {#each RiverPaths as d (d)}
        <path {d} fill="none" stroke="var(--feudum-river)" stroke-width="12" stroke-linecap="round"
        ></path>
    {/each}
    {#each RegionIds as region (region)}
        <text
            x={RegionLabels[region].x}
            y={RegionLabels[region].y}
            text-anchor="middle"
            font-size="26"
            fill="var(--feudum-map-ink)"
            fill-opacity="0.7"
            style:font-family="var(--feudum-font-title)">{region}</text
        >
    {/each}
</PieceFrame>
