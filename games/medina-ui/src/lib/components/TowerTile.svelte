<script lang="ts">
    import TileArt from './TileArt.svelte'

    let { tower, size, hasMerchants }: { tower: number; size: number; hasMerchants: boolean } =
        $props()

    const TRAY_INSET = 0.075
    const TRAY_TOP = 0.17
    const TRAY_HEIGHT = 0.26
    const FULL_NUMBER = { x: 0.26, y: 0.13, fontSize: 0.46 }
    const TRAY_NUMBER = { x: 0.24, y: -0.04, fontSize: 0.4 }
    const NUMBER_EDGE = 0.045

    const number = $derived(hasMerchants ? TRAY_NUMBER : FULL_NUMBER)
</script>

<TileArt name={hasMerchants ? 'tower-tray' : 'tower'} {size} />
<text
    class="tower-digit"
    x={size * number.x}
    y={size * number.y}
    text-anchor="middle"
    font-size={size * number.fontSize}
    stroke-width={size * number.fontSize * NUMBER_EDGE}>{tower}</text
>
{#if hasMerchants}
    <rect
        class="merchant-tray"
        x={-size * (0.5 - TRAY_INSET)}
        y={size * TRAY_TOP}
        width={size * (1 - 2 * TRAY_INSET)}
        height={size * TRAY_HEIGHT}
        rx={size * 0.015}
        fill="#173a2b"
    ></rect>
{/if}

<style>
    .tower-digit {
        fill: #173a2b;
        stroke: #c9dcc6;
        stroke-linejoin: round;
        paint-order: stroke;
        font-family: 'Medina Numerals', Georgia, serif;
    }
</style>
