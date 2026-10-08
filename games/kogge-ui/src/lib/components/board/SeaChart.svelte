<script lang="ts">
    import { LAKES_PATH, LAND_PATH, RIVERS_PATH } from '$lib/board/balticMap.js'
    import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/board/layout.js'
    import CompassRose from './CompassRose.svelte'

    const ROSE = { x: 640, y: 655 }
    const rhumbs = Array.from({ length: 32 }, (_, index) => (index * Math.PI) / 16)
    const waves = [
        [900, 470],
        [1010, 620],
        [560, 600],
        [860, 770],
        [1100, 420],
        [700, 470],
        [990, 760]
    ]
</script>

<defs>
    <filter id="kogge-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7"
        ></feTurbulence>
        <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.3  0 0 0 0 0.16  0 0 0 0.11 0"
        ></feColorMatrix>
        <feComposite in2="SourceGraphic" operator="in"></feComposite>
    </filter>
    <filter id="kogge-mottle" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="3"
        ></feTurbulence>
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.15  0 0 0 0.16 0"
        ></feColorMatrix>
        <feComposite in2="SourceGraphic" operator="in"></feComposite>
    </filter>
    <radialGradient id="kogge-sea" cx="0.5" cy="0.55" r="0.62">
        <stop offset="0" stop-color="#b9dbd3"></stop>
        <stop offset="0.7" stop-color="#9ccac4"></stop>
        <stop offset="1" stop-color="#86b9b6"></stop>
    </radialGradient>
    <clipPath id="kogge-board-clip">
        <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} rx="10"></rect>
    </clipPath>
</defs>

<g clip-path="url(#kogge-board-clip)">
    <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#kogge-sea)"></rect>

    <g fill="none" stroke="#5e9b9a" stroke-linejoin="round">
        <path d={LAND_PATH} stroke-width="34" stroke-opacity="0.12"></path>
        <path d={LAND_PATH} stroke-width="22" stroke-opacity="0.14"></path>
        <path d={LAND_PATH} stroke-width="12" stroke-opacity="0.18"></path>
        <path d={LAND_PATH} stroke-width="5" stroke-opacity="0.28"></path>
    </g>

    <g fill="#2f6f73" fill-opacity="0.35">
        {#each waves as [x, y], index (index)}
            <path
                d="M{x} {y} q6 -5 12 0 t12 0 t12 0"
                fill="none"
                stroke="#3f7f80"
                stroke-opacity="0.45"
                stroke-width="1.3"
            ></path>
        {/each}
    </g>

    <path d={LAND_PATH} fill="#ecdfba" fill-rule="evenodd"></path>
    <path d={LAND_PATH} fill="#000" fill-rule="evenodd" filter="url(#kogge-mottle)"></path>
    <path d={LAKES_PATH} fill="#a7d0c9" stroke="#6b5233" stroke-width="0.8"></path>
    <path d={RIVERS_PATH} fill="none" stroke="#6f9ea0" stroke-width="1.2" stroke-linecap="round"
    ></path>
    <path
        d={LAND_PATH}
        fill="none"
        stroke="#5b3f22"
        stroke-width="1.3"
        stroke-linejoin="round"
        fill-rule="evenodd"
    ></path>

    <g stroke="#5b3f22" stroke-opacity="0.16" stroke-width="0.8">
        {#each rhumbs as angle, index (index)}
            <line
                x1={ROSE.x}
                y1={ROSE.y}
                x2={ROSE.x + Math.cos(angle) * 1400}
                y2={ROSE.y + Math.sin(angle) * 1400}
                stroke-dasharray={index % 2 === 0 ? undefined : '6 5'}
            ></line>
        {/each}
    </g>
    <CompassRose x={ROSE.x} y={ROSE.y} size={128} />

    <rect width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#000" filter="url(#kogge-paper)"></rect>
</g>

<rect
    x="3"
    y="3"
    width={BOARD_WIDTH - 6}
    height={BOARD_HEIGHT - 6}
    rx="9"
    fill="none"
    stroke="#3f2a16"
    stroke-width="6"
></rect>
<rect
    x="11"
    y="11"
    width={BOARD_WIDTH - 22}
    height={BOARD_HEIGHT - 22}
    rx="5"
    fill="none"
    stroke="#3f2a16"
    stroke-width="1.2"
></rect>
