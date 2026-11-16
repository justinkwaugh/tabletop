<script lang="ts">
    import palace from '$lib/images/palace.webp'
    import {
        BOARD_WIDTH,
        BOX,
        CUSTOMER_BASE_X,
        EDGE,
        HEADER_HEIGHT,
        INITIAL_X,
        WORKS
    } from '$lib/utils/boardLayout.js'

    // The engraving covers the banner: scaled to fill it and centred, then clipped to it.
    const ART = { width: 1201, height: 121 }
    const scale = Math.max(BOARD_WIDTH / ART.width, HEADER_HEIGHT / ART.height)
    const artWidth = ART.width * scale
    const artHeight = ART.height * scale
    const LABEL_Y = HEADER_HEIGHT - 10
</script>

<defs>
    <clipPath id="lw-banner">
        <rect width={BOARD_WIDTH} height={HEADER_HEIGHT}></rect>
    </clipPath>
</defs>
<g clip-path="url(#lw-banner)">
    <rect width={BOARD_WIDTH} height={HEADER_HEIGHT} fill="#25303a"></rect>
    <image
        href={palace}
        x={(BOARD_WIDTH - artWidth) / 2}
        y={(HEADER_HEIGHT - artHeight) / 2}
        width={artWidth}
        height={artHeight}
    ></image>
    <rect width={BOARD_WIDTH} height={HEADER_HEIGHT} fill="#141b21" fill-opacity="0.35"></rect>
</g>
<text class="title" x={BOARD_WIDTH / 2} y="56" text-anchor="middle">Locomotive Werks</text>
<text class="years" x={BOARD_WIDTH / 2} y="80" text-anchor="middle">1804 · 1962</text>
<text class="label" x={EDGE} y={LABEL_Y}>Existing Orders</text>
<text class="label" x={INITIAL_X + BOX / 2} y={LABEL_Y} text-anchor="middle">Initial Orders</text>
<text class="label" x={WORKS.x + (WORKS.step * WORKS.columns) / 2} y={LABEL_Y} text-anchor="middle"
    >Werks</text
>
<text class="label" x={CUSTOMER_BASE_X + BOX / 2} y={LABEL_Y - 20} text-anchor="middle"
    >Customer</text
>
<text class="label" x={CUSTOMER_BASE_X + BOX / 2} y={LABEL_Y} text-anchor="middle">Base</text>

<style>
    .title {
        font-family: 'LW Playfair', Georgia, serif;
        font-size: 52px;
        fill: #d6e0e7;
        stroke: #141b21;
        stroke-width: 1.5px;
        paint-order: stroke;
    }

    .years {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.6em;
        fill: #d6e0e7;
    }

    .label {
        font-family: 'LW Playfair', Georgia, serif;
        font-size: 17px;
        fill: #d6e0e7;
    }
</style>
