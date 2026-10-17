<script lang="ts">
    import { LOGO_ORIGIN } from '$lib/utils/boardLayout.js'

    const RAIL =
        'M -26 8 Q -26 0 -18 0 L 18 0 Q 26 0 26 8 L 26 30 Q 26 38 16 40 Q 9 42 9 52 L 9 118 Q 9 128 22 130 L 64 134 Q 70 135 70 140 L 70 146 L -70 146 L -70 140 Q -70 135 -64 134 L -22 130 Q -9 128 -9 118 L -9 52 Q -9 42 -16 40 Q -26 38 -26 30 Z'
    const FLAG = ['#111111', '#f4f0d8', '#c8202a']

    // The cover's track underline: two thin rails over ties, as wide as the word.
    const NAME_WIDTH = 178
    const TRACK_Y = 96
    const TRACK_HEIGHT = 6
    const TIE_STEP = 2.8
    const TIES = Array.from(
        { length: Math.floor(NAME_WIDTH / TIE_STEP) + 1 },
        (_, index) => -NAME_WIDTH / 2 + index * TIE_STEP
    )
</script>

<g transform="translate({LOGO_ORIGIN.x} {LOGO_ORIGIN.y})" role="img" aria-label="Railheads Germany">
    <path d={RAIL} class="rail" />
    {#each FLAG as color, index (color)}
        <rect x="-16" y={8 + index * 8} width="32" height="8" fill={color} />
    {/each}
    <rect x="-16" y="8" width="32" height="24" class="flag-edge" />
    <text y="91" textLength={NAME_WIDTH} lengthAdjust="spacingAndGlyphs" class="name edge"
        >Railheads</text
    >
    <text y="91" textLength={NAME_WIDTH} lengthAdjust="spacingAndGlyphs" class="name"
        >Railheads</text
    >
    <g class="track">
        {#each TIES as x (x)}
            <rect {x} y={TRACK_Y} width="1.3" height={TRACK_HEIGHT} />
        {/each}
        <rect x={-NAME_WIDTH / 2} y={TRACK_Y + 1} width={NAME_WIDTH + 1} height="0.9" />
        <rect
            x={-NAME_WIDTH / 2}
            y={TRACK_Y + TRACK_HEIGHT - 1.7}
            width={NAME_WIDTH + 1}
            height="0.9"
        />
    </g>
    <text y="124" class="edition">Germany</text>
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
        font-family: 'Railheads Alegreya', Georgia, serif;
        font-weight: 700;
        text-anchor: middle;
        paint-order: stroke;
        stroke-linejoin: round;
        pointer-events: none;
    }

    .name {
        fill: #000000;
        stroke: #ffffff;
        stroke-width: 5px;
        font-size: 50px;
    }

    /* A hairline beyond the white outline keeps the word's silhouette on the pale board. */
    .name.edge {
        stroke: #1d1d1b;
        stroke-width: 7px;
    }

    .track {
        fill: #1d1d1b;
        pointer-events: none;
    }

    .edition {
        fill: #ffffff;
        stroke: #3c5816;
        stroke-width: 6px;
        font-size: 25px;
    }
</style>
