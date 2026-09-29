<script lang="ts">
    import { localHexPoints } from '$lib/utils/boardGeometry.js'

    let { frontier }: { frontier: boolean } = $props()

    const HOUSE_ANGLES = [-90, -38, 14, 66, 118, 170, 222]
    const houses = HOUSE_ANGLES.map((angle, index) => {
        const radians = (angle * Math.PI) / 180
        return {
            x: Math.cos(radians) * 23,
            y: Math.sin(radians) * 23,
            rotation: angle + 90,
            wide: index % 3 === 0
        }
    })
</script>

<g class="village">
    {#if frontier}
        <polygon
            points={localHexPoints(4)}
            fill="none"
            stroke="#3f7d35"
            stroke-width="4"
            stroke-linejoin="round"
        ></polygon>
        <polygon
            points={localHexPoints(4)}
            fill="none"
            stroke="#8cc26b"
            stroke-width="1.2"
            stroke-linejoin="round"
        ></polygon>
    {/if}
    <ellipse cx="0" cy="2" rx="17" ry="15" fill="#e9d59c"></ellipse>
    <ellipse cx="0" cy="2" rx="17" ry="15" fill="none" stroke="#c9ab63" stroke-width="1"></ellipse>
    <circle cx="0" cy="2" r="3.2" fill="#9fb8c9" stroke="#7d8f98" stroke-width="0.8"></circle>
    {#each houses as house, index (index)}
        <g transform="translate({house.x} {house.y}) rotate({house.rotation})">
            <rect
                x={house.wide ? -6 : -4.5}
                y="-3.5"
                width={house.wide ? 12 : 9}
                height="8"
                rx="0.8"
                fill="#f6efe0"
                stroke="#8c7453"
                stroke-width="0.7"
            ></rect>
            <rect
                x={house.wide ? -6.5 : -5}
                y="-5.5"
                width={house.wide ? 13 : 10}
                height="4"
                rx="0.8"
                fill="#b8573a"
                stroke="#7e3522"
                stroke-width="0.6"
            ></rect>
        </g>
    {/each}
</g>
