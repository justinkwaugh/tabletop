<script lang="ts">
    import { LOGO_ORIGIN } from '$lib/utils/boardLayout.js'

    const RAIL =
        'M -26 8 Q -26 0 -18 0 L 18 0 Q 26 0 26 8 L 26 30 Q 26 38 16 40 Q 9 42 9 52 L 9 118 Q 9 128 22 130 L 64 134 Q 70 135 70 140 L 70 146 L -70 146 L -70 140 Q -70 135 -64 134 L -22 130 Q -9 128 -9 118 L -9 52 Q -9 42 -16 40 Q -26 38 -26 30 Z'
    const FLAG = ['#111111', '#f4f0d8', '#c8202a']
</script>

<g transform="translate({LOGO_ORIGIN.x} {LOGO_ORIGIN.y})" role="img" aria-label="Railheads Germany">
    <path d={RAIL} class="rail" />
    {#each FLAG as color, index (color)}
        <rect x="-16" y={8 + index * 8} width="32" height="8" fill={color} />
    {/each}
    <rect x="-16" y="8" width="32" height="24" class="flag-edge" />
    <text y="92" class="name">Railheads</text>
    <text y="121" class="edition">Germany</text>
</g>

<style>
    .rail {
        fill: #1d1d1b;
        stroke: #4a5a24;
        stroke-width: 1.5;
    }

    .flag-edge {
        fill: none;
        stroke: #8f8a5c;
        stroke-width: 1;
    }

    text {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
        paint-order: stroke;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .name {
        fill: #ffffff;
        stroke: #1d1d1b;
        stroke-width: 6px;
        font-size: 44px;
        letter-spacing: 0.01em;
    }

    .edition {
        fill: #5f9a2e;
        stroke: #1d1d1b;
        stroke-width: 4px;
        font-size: 22px;
    }
</style>
