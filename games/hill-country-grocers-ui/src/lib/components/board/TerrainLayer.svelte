<script lang="ts">
    import { HILL_COUNTRY_MAP, cityAt } from '@tabletop/hill-country-grocers'
    import hcgLogo from '$lib/images/hcg_logo.png'
    import { MAP_RECT, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'
    import { MEADOW_TINTS, TOWN_GROUND, coordsSeed } from '$lib/utils/mapStyle.js'

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


    const HILLS = [
        { x: 120, y: 120, rx: 150, ry: 70 },
        { x: 560, y: 70, rx: 220, ry: 60 },
        { x: 860, y: 600, rx: 170, ry: 90 },
        { x: 300, y: 560, rx: 200, ry: 80 },
        { x: 700, y: 360, rx: 160, ry: 70 }
    ]

    const compass = { x: MAP_RECT.x + 62, y: MAP_RECT.y + 78 }
    // The bottom of the map is left clear of hexes so the game's logo covers none of them.
    const logo = { x: MAP_RECT.x + 8, y: MAP_RECT.y + MAP_RECT.height - 151, width: 225, height: 143 }
</script>

<defs>
    <linearGradient id="hcg-hills" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#8e9a59" />
        <stop offset="0.5" stop-color="#7b8a4b" />
        <stop offset="1" stop-color="#66763f" />
    </linearGradient>
    <radialGradient id="hcg-sunlight" cx="0.3" cy="0.2" r="0.9">
        <stop offset="0" stop-color="#fff4c8" stop-opacity="0.35" />
        <stop offset="0.6" stop-color="#fff4c8" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="hcg-tile-shade">
        <stop offset="0" stop-color="#fffbe8" stop-opacity="0.22" />
        <stop offset="0.7" stop-color="#fffbe8" stop-opacity="0" />
        <stop offset="1" stop-color="#4a3a14" stop-opacity="0.18" />
    </radialGradient>
    <filter id="hcg-tile-shadow" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.8" flood-color="#2a2410" flood-opacity="0.45" />
    </filter>
    <clipPath id="hcg-map-clip">
        <rect x={MAP_RECT.x} y={MAP_RECT.y} width={MAP_RECT.width} height={MAP_RECT.height} rx="14" />
    </clipPath>
</defs>

<g clip-path="url(#hcg-map-clip)" aria-hidden="true">
    <rect x={MAP_RECT.x} y={MAP_RECT.y} width={MAP_RECT.width} height={MAP_RECT.height} fill="url(#hcg-hills)" />
    <g transform="translate({MAP_RECT.x} {MAP_RECT.y})">
        {#each HILLS as hill, index (index)}
            {#each [1, 0.72, 0.44] as ring (ring)}
                <ellipse cx={hill.x} cy={hill.y} rx={hill.rx * ring} ry={hill.ry * ring} class="contour" />
            {/each}
        {/each}
    </g>
    <rect x={MAP_RECT.x} y={MAP_RECT.y} width={MAP_RECT.width} height={MAP_RECT.height} fill="url(#hcg-sunlight)" />

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

<g transform="translate({compass.x} {compass.y})" aria-hidden="true" class="compass">
    <circle r="34" class="compass-ring" />
    <circle r="27" class="compass-inner" />
    <polygon points="0,-30 6,-6 0,0 -6,-6" class="needle-dark" />
    <polygon points="0,30 6,6 0,0 -6,6" class="needle-light" />
    <polygon points="-30,0 -6,-6 0,0 -6,6" class="needle-light" />
    <polygon points="30,0 6,-6 0,0 6,6" class="needle-dark" />
    <text y="-38" class="compass-n">N</text>
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
    x={MAP_RECT.x}
    y={MAP_RECT.y}
    width={MAP_RECT.width}
    height={MAP_RECT.height}
    rx="14"
    class="map-frame"
/>

<style>
    .contour {
        fill: none;
        stroke: #b5bd7c;
        stroke-width: 1.6;
        opacity: 0.35;
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




    .compass-ring {
        fill: #f3ead0;
        stroke: #7a1d22;
        stroke-width: 2.5;
    }

    .compass-inner {
        fill: none;
        stroke: #b59a68;
        stroke-width: 1;
        stroke-dasharray: 2 3;
    }

    .needle-dark {
        fill: #7a1d22;
    }

    .needle-light {
        fill: #d9c79a;
        stroke: #7a1d22;
        stroke-width: 0.8;
    }

    .compass-n {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #f6efd8;
        text-anchor: middle;
        paint-order: stroke;
        stroke: #7a1d22;
        stroke-width: 3px;
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
