<script lang="ts">
    import { CITY_PLACEMENTS, pierStart } from '$lib/board/layout.js'
</script>

{#each CITY_PLACEMENTS as placement (placement.number)}
    {@const pier = pierStart(placement)}
    <g pointer-events="none">
        <line
            x1={pier.x}
            y1={pier.y}
            x2={placement.harbour.x}
            y2={placement.harbour.y}
            stroke="#5a3a1c"
            stroke-width="7"
            stroke-linecap="round"
        ></line>
        <line
            x1={pier.x}
            y1={pier.y}
            x2={placement.harbour.x}
            y2={placement.harbour.y}
            stroke="#a07240"
            stroke-width="4"
            stroke-dasharray="3 2"
        ></line>
        <circle cx={placement.harbour.x} cy={placement.harbour.y} r="5" fill="#3f2a16"></circle>
    </g>
{/each}
