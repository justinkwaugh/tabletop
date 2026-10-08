<script lang="ts">
    import { MARKET_GROUND, MARKET_TABLE } from '$lib/utils/pieceColors.js'

    let { size = 100 }: { size?: number } = $props()

    const id = `market-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)
    const grainAngle = Math.floor(Math.random() * 40) - 20

    // Seen from the front and a little above and to the right. Boxes are in table space:
    // x across, h up from the ground, z back from the front.
    const GROUND_Y = 78
    const ZX = 0.45
    const ZY = 0.33
    const at = (x: number, h: number, z: number) =>
        `${(x + z * ZX - 8).toFixed(2)},${(GROUND_Y - h - z * ZY).toFixed(2)}`
    type Box = { x0: number; x1: number; h0: number; h1: number; z0: number; z1: number }
    const faces = (b: Box) => ({
        front: [
            at(b.x0, b.h0, b.z0),
            at(b.x1, b.h0, b.z0),
            at(b.x1, b.h1, b.z0),
            at(b.x0, b.h1, b.z0)
        ].join(' '),
        top: [
            at(b.x0, b.h1, b.z0),
            at(b.x1, b.h1, b.z0),
            at(b.x1, b.h1, b.z1),
            at(b.x0, b.h1, b.z1)
        ].join(' '),
        side: [
            at(b.x1, b.h0, b.z0),
            at(b.x1, b.h0, b.z1),
            at(b.x1, b.h1, b.z1),
            at(b.x1, b.h1, b.z0)
        ].join(' ')
    })
    const parts = [
        { x0: 27, x1: 35, h0: 0, h1: 22, z0: 3, z1: 33 },
        { x0: 65, x1: 73, h0: 0, h1: 22, z0: 3, z1: 33 },
        { x0: 23, x1: 77, h0: 22, h1: 35, z0: 0, z1: 36 }
    ].map((box, i) => ({ i, ...faces(box) }))
    const shadow = [at(23, 0, 0), at(77, 0, 0), at(81, 0, 36), at(27, 0, 36)].join(' ')
</script>

<svg
    class="pointer-events-none"
    overflow="visible"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <filter id="{id}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="2" {seed}
            ></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
        <filter id="{id}-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3"></feGaussianBlur>
        </filter>
        <clipPath id="{id}-table">
            {#each parts as part (part.i)}
                <polygon points={part.front}></polygon>
                <polygon points={part.top}></polygon>
                <polygon points={part.side}></polygon>
            {/each}
        </clipPath>
    </defs>

    <!-- The ground bleeds past the square so scaled boards show no seams. -->
    <rect x="-1" y="-1" width="102" height="102" fill={MARKET_GROUND}></rect>
    <rect
        width="100"
        height="100"
        filter="url(#{id}-grain)"
        opacity="0.05"
        style="mix-blend-mode: screen"
    ></rect>

    <g transform="translate(50 56) scale(0.95) translate(-50 -56)">
        <g filter="url(#{id}-soft)" opacity="0.22">
            <polygon points={shadow} fill="#000" transform="translate(3 1)"></polygon>
        </g>
        {#each parts as part (part.i)}
            <polygon points={part.side} fill={MARKET_TABLE}></polygon>
            <polygon points={part.side} fill="#000" opacity="0.38"></polygon>
            <polygon points={part.top} fill={MARKET_TABLE}></polygon>
            <polygon points={part.top} fill="#fff" opacity="0.14"></polygon>
            <polygon points={part.front} fill={MARKET_TABLE}></polygon>
            <polyline
                points={part.front.split(' ').slice(2).reverse().join(' ')}
                fill="none"
                stroke="#fff"
                stroke-opacity="0.18"
                stroke-width="1.4"
                stroke-linecap="round"
            ></polyline>
        {/each}
        <g clip-path="url(#{id}-table)">
            <rect
                width="100"
                height="100"
                filter="url(#{id}-grain)"
                opacity="0.22"
                style="mix-blend-mode: multiply"
                transform="rotate({grainAngle} 50 50)"
            ></rect>
        </g>
    </g>
</svg>
