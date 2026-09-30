<script lang="ts">
    import { offsetToAxial } from '@tabletop/magna-grecia'
    import { BOARD_HEIGHT, BOARD_WIDTH, hexCenter } from '$lib/utils/boardGeometry.js'
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

    <g transform="translate({bay.x} {bay.y + 22})">
        <path
            d="M -150 -26 h 300 l 14 26 l -14 26 h -300 l -14 -26 z"
            fill="#f3e6c4"
            stroke="#8c5b2e"
            stroke-width="2"
            opacity="0.94"
        ></path>
        <path
            d="M -144 -20 h 288 l 10 20 l -10 20 h -288 l -10 -20 z"
            fill="none"
            stroke="#b8793d"
            stroke-width="1"
        ></path>
        <text
            y="-2"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="24"
            letter-spacing="7"
            fill="#6b3f1d">MAGNA GRECIA</text
        >
        <text
            y="15"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="11"
            letter-spacing="6"
            fill="#8c5b2e">ΜΕΓΑΛΗ ΕΛΛΑΣ</text
        >
    </g>
</g>
