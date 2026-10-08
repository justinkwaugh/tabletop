<script lang="ts">
    import { HILL_COUNTRY_MAP, cityAt } from '@tabletop/hill-country-grocers'
    import hcgLogo from '$lib/images/hcg_logo.png'
    import {
        MAP_RECT,
        SHEET_RECT,
        hexCenter,
        SHEET_CORNER,
        hexPoints
    } from '$lib/utils/boardLayout.js'
    import {
        MEADOW_TINTS,
        TOWN_GROUND,
        contourPath,
        coordsSeed,
        type ContourHill
    } from '$lib/utils/mapStyle.js'

    type Decoration = 'oaks' | 'bluebonnets' | 'limestone' | 'cactus' | 'none'

    function decorationFor(seed: number): Decoration {
        if (seed < 0.3) return 'oaks'
        if (seed < 0.5) return 'bluebonnets'
        if (seed < 0.64) return 'limestone'
        if (seed < 0.76) return 'cactus'
        return 'none'
    }

    const tiles = HILL_COUNTRY_MAP.hexes().map((place) => {
        const seed = coordsSeed(place.coords)
        const town = cityAt(place.coords) !== undefined
        return {
            key: `${place.coords.q},${place.coords.r}`,
            center: hexCenter(place.coords),
            fill: town ? TOWN_GROUND : MEADOW_TINTS[Math.floor(seed * 997) % MEADOW_TINTS.length],
            decoration: town ? 'none' : decorationFor(seed),
            grass: !town && seed > 0.45,
            flip: seed > 0.5 ? -1 : 1
        }
    })


    const HILLS: ContourHill[] = [
        { x: 110, y: 120, rx: 170, ry: 95, seed: 0.4 },
        { x: 520, y: 60, rx: 240, ry: 85, seed: 1.7 },
        { x: 880, y: 250, rx: 150, ry: 120, seed: 2.9 },
        { x: 330, y: 470, rx: 210, ry: 120, seed: 4.2 },
        { x: 760, y: 560, rx: 190, ry: 110, seed: 5.6 },
        { x: 560, y: 760, rx: 260, ry: 90, seed: 0.9 }
    ]
    const CONTOUR_RINGS = [1, 0.82, 0.64, 0.46, 0.28]

    const GRID_STEP = 118
    const meridians = Array.from(
        { length: Math.floor(MAP_RECT.width / GRID_STEP) },
        (_, index) => MAP_RECT.x + (index + 1) * GRID_STEP
    )
    const parallels = Array.from(
        { length: Math.floor(MAP_RECT.height / GRID_STEP) },
        (_, index) => MAP_RECT.y + (index + 1) * GRID_STEP
    )

    const COUNTY_LINES = [
        'M 0 300 L 160 310 L 250 250 L 420 262 L 470 180 L 640 170 L 700 0',
        'M 380 778 L 400 640 L 560 600 L 600 470 L 780 430 L 950 470',
        'M 0 560 L 120 600 L 210 700 L 260 778'
    ]

    // The bottom of the map is left clear of hexes so the game's logo covers none of them.
    const logo = { x: MAP_RECT.x + 8, y: MAP_RECT.y + MAP_RECT.height - 142, width: 210, height: 134 }
</script>

<defs>
    <radialGradient id="hcg-paper-age" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stop-color="#8a6a32" stop-opacity="0" />
        <stop offset="1" stop-color="#8a6a32" stop-opacity="0.32" />
    </radialGradient>
    <filter id="hcg-paper-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
        <feColorMatrix
            values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.16  0 0 0 0.16 0"
        />
    </filter>
    <radialGradient id="hcg-tile-shade">
        <stop offset="0" stop-color="#fffbe8" stop-opacity="0.22" />
        <stop offset="0.7" stop-color="#fffbe8" stop-opacity="0" />
        <stop offset="1" stop-color="#4a3a14" stop-opacity="0.18" />
    </radialGradient>
    <filter id="hcg-tile-shadow" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.8" flood-color="#2a2410" flood-opacity="0.45" />
    </filter>
    <clipPath id="hcg-map-clip">
        <rect
            x={SHEET_RECT.x}
            y={SHEET_RECT.y}
            width={SHEET_RECT.width}
            height={SHEET_RECT.height}
            rx={SHEET_CORNER}
        />
    </clipPath>
</defs>

<g clip-path="url(#hcg-map-clip)" aria-hidden="true">
    <rect x={SHEET_RECT.x} y={SHEET_RECT.y} width={SHEET_RECT.width} height={SHEET_RECT.height} class="paper" />
    <rect
        x={SHEET_RECT.x}
        y={SHEET_RECT.y}
        width={SHEET_RECT.width}
        height={SHEET_RECT.height}
        filter="url(#hcg-paper-grain)"
    />
    {#each meridians as x (x)}
        <line x1={x} y1={SHEET_RECT.y} x2={x} y2={MAP_RECT.y + MAP_RECT.height} class="graticule" />
    {/each}
    {#each parallels as y (y)}
        <line x1={MAP_RECT.x} y1={y} x2={MAP_RECT.x + MAP_RECT.width} y2={y} class="graticule" />
    {/each}
    <g transform="translate({MAP_RECT.x} {MAP_RECT.y})">
        {#each HILLS as hill (hill.seed)}
            {#each CONTOUR_RINGS as ring, index (ring)}
                <path d={contourPath(hill, ring)} class="contour" class:index={index === 0} />
            {/each}
        {/each}
        {#each COUNTY_LINES as line (line)}
            <path d={line} class="county" />
        {/each}
    </g>
    <rect
        x={SHEET_RECT.x}
        y={SHEET_RECT.y}
        width={SHEET_RECT.width}
        height={SHEET_RECT.height}
        fill="url(#hcg-paper-age)"
    />

    {#each tiles as tile (tile.key)}
        <g transform="translate({tile.center.x} {tile.center.y})" filter="url(#hcg-tile-shadow)">
            <polygon points={hexPoints({ x: 0, y: 0 }, 71)} fill={tile.fill} />
            <polygon points={hexPoints({ x: 0, y: 0 }, 71)} fill="url(#hcg-tile-shade)" />
        </g>
    {/each}

    {#each tiles as tile (tile.key)}
        <g transform="translate({tile.center.x} {tile.center.y})">
            {#if tile.decoration === 'oaks'}
                <g transform="scale({tile.flip} 1)">
                    {#each [{ x: -30, y: -36, r: 9 }, { x: -12, y: -44, r: 11 }, { x: 8, y: -38, r: 8 }] as oak (oak.x)}
                        <rect x={oak.x - 1.5} y={oak.y + oak.r - 3} width="3" height="8" class="trunk" />
                        <circle cx={oak.x} cy={oak.y} r={oak.r} class="canopy" />
                        <circle cx={oak.x - oak.r * 0.3} cy={oak.y - oak.r * 0.3} r={oak.r * 0.45} class="canopy-light" />
                    {/each}
                </g>
            {:else if tile.decoration === 'bluebonnets'}
                <g transform="scale({tile.flip} 1)">
                    {#each [[-34, -34], [-28, -40], [-22, -33], [-16, -41], [-10, -35], [-4, -42], [2, -36], [8, -40]] as [bx, by] (`${bx},${by}`)}
                        <line x1={bx} y1={by + 6} x2={bx} y2={by + 1} class="stem" />
                        <ellipse cx={bx} cy={by} rx="2.4" ry="3.6" class="bloom" />
                        <circle cx={bx} cy={by - 2.6} r="1.1" class="bloom-tip" />
                    {/each}
                </g>
            {:else if tile.decoration === 'limestone'}
                <g transform="scale({tile.flip} 1)">
                    <ellipse cx="-22" cy="-36" rx="14" ry="7" class="rock" />
                    <ellipse cx="-6" cy="-40" rx="9" ry="5" class="rock" />
                    <ellipse cx="-24" cy="-38.5" rx="9" ry="3" class="rock-light" />
                </g>
            {:else if tile.decoration === 'cactus'}
                <g transform="scale({tile.flip} 1)">
                    <ellipse cx="-24" cy="-34" rx="7" ry="10" class="cactus" />
                    <ellipse cx="-16" cy="-44" rx="5.5" ry="7.5" class="cactus" transform="rotate(25 -16 -44)" />
                    <ellipse cx="-31" cy="-44" rx="5" ry="7" class="cactus" transform="rotate(-25 -31 -44)" />
                    <circle cx="-16" cy="-51" r="2" class="cactus-flower" />
                </g>
            {/if}
            {#if tile.grass}
                <g transform="translate({28 * tile.flip} 44)" class="grass">
                    <path d="M -8 0 q 2 -8 4 -10 M -3 0 q 1 -9 0 -12 M 2 0 q 1 -7 5 -9 M 6 0 q 2 -6 6 -7" />
                </g>
            {/if}
            <polygon points={hexPoints({ x: 0, y: 0 }, 71)} class="tile-edge" />
        </g>
    {/each}

</g>


<image
    href={hcgLogo}
    x={logo.x}
    y={logo.y}
    width={logo.width}
    height={logo.height}
    class="logo"
    aria-label="Hill Country Grocers"
/>

<rect
    x={SHEET_RECT.x}
    y={SHEET_RECT.y}
    width={SHEET_RECT.width}
    height={SHEET_RECT.height}
    rx={SHEET_CORNER}
    class="map-frame"
/>

<style>
    .paper {
        fill: #eadcb6;
    }

    .graticule {
        stroke: #a98b58;
        stroke-width: 0.8;
        opacity: 0.35;
    }

    .contour {
        fill: none;
        stroke: #9c7a46;
        stroke-width: 1.1;
        opacity: 0.45;
    }

    .contour.index {
        stroke-width: 1.8;
        opacity: 0.55;
    }

    .county {
        fill: none;
        stroke: #8e3b2a;
        stroke-width: 1.6;
        stroke-dasharray: 10 4 2 4;
        opacity: 0.45;
    }

    .tile-edge {
        fill: none;
        stroke: rgba(70, 55, 25, 0.55);
        stroke-width: 1.6;
    }

    .trunk {
        fill: #5b4026;
    }

    .canopy {
        fill: #4d6a2c;
        stroke: #2f4419;
        stroke-width: 1;
    }

    .canopy-light {
        fill: #6f8c3e;
    }

    .stem {
        stroke: #4f6b2e;
        stroke-width: 1.2;
    }

    .bloom {
        fill: #3d5fb6;
    }

    .bloom-tip {
        fill: #f4f1e6;
    }

    .rock {
        fill: #d8d0b8;
        stroke: #9a8e6e;
        stroke-width: 1;
    }

    .rock-light {
        fill: #ece6d4;
    }

    .cactus {
        fill: #6f9a4a;
        stroke: #3f5f26;
        stroke-width: 1;
    }

    .cactus-flower {
        fill: #e8b830;
    }

    .grass path {
        fill: none;
        stroke: #8a8a45;
        stroke-width: 1.4;
        stroke-linecap: round;
    }













    .logo {
        filter: drop-shadow(0 3px 4px rgba(30, 20, 5, 0.45));
    }

    .map-frame {
        fill: none;
        stroke: #7a1d22;
        stroke-width: 5;
    }
</style>
