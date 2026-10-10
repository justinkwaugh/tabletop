<script lang="ts">
    import { PAINT_DARK, TRUCK_WOOD } from '$lib/utils/pieceColors.js'

    let { value, size = 64 }: { value: number; size?: number } = $props()

    const id = `sign-${Math.random().toString(36).slice(2)}`
    const seed = Math.floor(Math.random() * 1000)

    // An arrow-shaped direction board on a post, cut from the same wood as the trucks.
    const BOARD = '2,14 78,14 98,39 78,64 2,64'
    const DEPTH = 4
</script>

<svg
    class="pointer-events-none shrink-0"
    overflow="visible"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <filter id="{id}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.18 0.012" numOctaves="2" {seed}
            ></feTurbulence>
            <feColorMatrix type="saturate" values="0"></feColorMatrix>
        </filter>
        <filter id="{id}-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3"></feGaussianBlur>
        </filter>
        <clipPath id="{id}-board"><polygon points={BOARD}></polygon></clipPath>
    </defs>

    <ellipse cx="44" cy="96" rx="14" ry="3.5" fill="#000" opacity="0.35" filter="url(#{id}-soft)"
    ></ellipse>

    <rect x="38" y="40" width="12" height="56" fill={TRUCK_WOOD}></rect>
    <rect x="38" y="40" width="12" height="56" fill="#000" opacity="0.45"></rect>
    <rect x="46" y="40" width="4" height="56" fill="#000" opacity="0.2"></rect>

    <g filter="url(#{id}-soft)" opacity="0.5">
        <polygon points={BOARD} fill="#000" transform="translate(4 4)"></polygon>
    </g>
    {#each Array.from({ length: DEPTH }, (_, i) => DEPTH - i) as i (i)}
        <g transform="translate({i} {-i})">
            <polygon points={BOARD} fill={TRUCK_WOOD}></polygon>
            <polygon points={BOARD} fill="#000" opacity="0.3"></polygon>
        </g>
    {/each}
    <polygon points={BOARD} fill={TRUCK_WOOD}></polygon>
    <g clip-path="url(#{id}-board)">
        <rect
            width="100"
            height="100"
            filter="url(#{id}-grain)"
            opacity="0.13"
            style="mix-blend-mode: multiply"
        ></rect>
    </g>

    <text
        x="44"
        y="53"
        text-anchor="middle"
        font-size="40"
        style="font-family: var(--ff-label-font, inherit)"
        fill={PAINT_DARK}
        opacity="0.92">{value}</text
    >
</svg>
