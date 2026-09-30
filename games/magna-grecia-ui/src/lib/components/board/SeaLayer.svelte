<script lang="ts">
    import { offsetToAxial } from '@tabletop/magna-grecia'
    import { BOARD_HEIGHT, BOARD_WIDTH, HEX, hexCenter } from '$lib/utils/boardGeometry.js'
    import Trireme from './Trireme.svelte'

    const bay = hexCenter(offsetToAxial({ row: 15, col: 5 }))
    const westSea = hexCenter(offsetToAxial({ row: 10, col: 0 }))
    const eastSea = hexCenter(offsetToAxial({ row: 12, col: 15 }))

    const waves = Array.from({ length: 34 }, (_, index) => ({
        x: ((index * 373) % (BOARD_WIDTH - 80)) + 40,
        y: ((index * 211) % (BOARD_HEIGHT - 60)) + 30,
        scale: 0.7 + ((index * 7) % 5) * 0.12
    }))
</script>

<g aria-hidden="true">
    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="url(#mg-sea)"></rect>
    <g stroke="#bfe3ec" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.45">
        {#each waves as wave, index (index)}
            <path
                transform="translate({wave.x} {wave.y}) scale({wave.scale})"
                d="M -14 0 q 3.5 -4 7 0 t 7 0 t 7 0 t 7 0"
            ></path>
        {/each}
    </g>

    <Trireme x={westSea.x - 40} y={westSea.y + 10} scale={0.9} />
    <Trireme x={eastSea.x + 55} y={eastSea.y + 40} scale={0.8} flip />

    <g transform="translate({bay.x - HEX.xRadius} {bay.y + 22 + HEX.yRadius})">
        <path
            d="M -190 -38 h 380 l 18 38 l -18 38 h -380 l -18 -38 z"
            fill="#f3e6c4"
            stroke="#8c5b2e"
            stroke-width="2"
            opacity="0.94"
        ></path>
        <path
            d="M -184 -32 h 368 l 14 32 l -14 32 h -368 l -14 -32 z"
            fill="none"
            stroke="#b8793d"
            stroke-width="1"
        ></path>
        <text
            y="0"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="32"
            letter-spacing="6"
            fill="#6b3f1d">MAGNA GRECIA</text
        >
        <text
            y="23"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="16"
            font-style="italic"
            letter-spacing="1"
            fill="#8c5b2e">By Michael Schacht and Leo Colovini</text
        >
    </g>
</g>
