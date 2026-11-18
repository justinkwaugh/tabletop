<script lang="ts">
    import { MAP_TITLE, type MapLayout } from '$lib/utils/mapLayouts.js'

    let { layout }: { layout: MapLayout } = $props()
</script>

<!-- The board's title in the open sea where the map's layout puts it, over the map's printed name,
     in white like the capacity marks. -->
<g class="map-title" aria-hidden="true" data-map-title>
    <text
        class="rtr-display"
        x={layout.title.x}
        y={layout.title.y}
        text-anchor="middle"
        font-size={MAP_TITLE.size}
        letter-spacing={MAP_TITLE.letterSpacing}
        fill="var(--rtr-white)">Ride the Rails</text
    >
    <text
        class="rtr-serif"
        x={layout.title.x}
        y={layout.title.y + MAP_TITLE.nameDrop}
        text-anchor="middle"
        font-size={MAP_TITLE.nameSize}
        letter-spacing={MAP_TITLE.nameLetterSpacing}
        fill="var(--rtr-white)">{layout.name}</text
    >
</g>
