<script lang="ts">
    import { BOARD_GRID, SpaceType } from '@tabletop/magna-grecia'
    import { coordsSeed, hexCenter, localHexPoints } from '$lib/utils/boardGeometry.js'
    import Village from './Village.svelte'

    const LAND_TINTS = ['#d6b564', '#d1af5d', '#d7b96c', '#cbac5a', '#d3b360']

    type Decoration = 'wheat' | 'rocks' | 'none'

    const spaces = [...BOARD_GRID].map((space) => {
        const seed = coordsSeed(space.coords)
        const decoration: Decoration =
            space.type === SpaceType.Village
                ? 'none'
                : seed >= 0.2 && seed < 0.38
                  ? 'wheat'
                  : seed >= 0.38 && seed < 0.46
                    ? 'rocks'
                    : 'none'
        return {
            key: space.id,
            center: hexCenter(space.coords),
            space,
            tint: LAND_TINTS[Math.floor(seed * 997) % LAND_TINTS.length],
            decoration,
            flip: seed > 0.5 ? -1 : 1
        }
    })

    const hexShape = localHexPoints()
    const coastShape = localHexPoints(-9)
    const shoreShape = localHexPoints(-3)
</script>

<g class="coast" aria-hidden="true">
    {#each spaces as { key, center } (key)}
        <polygon
            points={coastShape}
            transform="translate({center.x} {center.y})"
            fill="#efe0b0"
            stroke="#efe0b0"
            stroke-width="6"
            stroke-linejoin="round"
        ></polygon>
    {/each}
    {#each spaces as { key, center } (key)}
        <polygon points={shoreShape} transform="translate({center.x} {center.y})" fill="#e4cd8f"
        ></polygon>
    {/each}
</g>

<g class="land" aria-hidden="true">
    {#each spaces as { key, center, space, tint, decoration, flip } (key)}
        <g transform="translate({center.x} {center.y})">
            <polygon points={hexShape} fill={tint}></polygon>
            <polygon points={hexShape} fill="url(#mg-land-shade)"></polygon>
            {#if decoration === 'wheat'}
                <g stroke="#a8812f" stroke-width="1.6" stroke-linecap="round" opacity="0.75">
                    <path d="M -16 12 l 3 -9 M -11 13 l 1 -10 M -6 12 l -1 -9"></path>
                    <path d="M 8 -8 l 3 -9 M 13 -7 l 1 -10 M 18 -8 l -1 -9"></path>
                </g>
            {:else if decoration === 'rocks'}
                <g transform="scale({flip} 1)">
                    <ellipse cx="10" cy="12" rx="7" ry="4.5" fill="#b59a66"></ellipse>
                    <ellipse cx="3" cy="15" rx="4.5" ry="3" fill="#a78c5a"></ellipse>
                    <ellipse cx="11" cy="10.5" rx="4" ry="1.8" fill="#cdb684"></ellipse>
                </g>
            {/if}
            <polygon
                points={hexShape}
                fill="none"
                stroke="rgba(255, 250, 235, 0.55)"
                stroke-width="1.2"
            ></polygon>
            {#if space.type === SpaceType.Village}
                <Village frontier={space.frontier} />
            {/if}
        </g>
    {/each}
</g>
