<script lang="ts">
    import { BOARD_SIZE } from '@tabletop/urbino'
    import { BOARD_MARGIN, BOARD_PIXELS, SQUARE_SIZE, columnName, rowName } from '$lib/board/geometry.js'

    const gridStart = BOARD_MARGIN
    const gridEnd = BOARD_MARGIN + BOARD_SIZE * SQUARE_SIZE
    const grooves = Array.from({ length: BOARD_SIZE + 1 }, (_, i) => BOARD_MARGIN + i * SQUARE_SIZE)
    const frameInset = BOARD_MARGIN - 7
    const labelOffset = 15
    const lines = Array.from({ length: BOARD_SIZE }, (_, i) => i)
</script>

<defs>
    <linearGradient id="urbino-board-wood" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ebc48f" />
        <stop offset="0.5" stop-color="#ddb07a" />
        <stop offset="1" stop-color="#d09e66" />
    </linearGradient>
    <filter id="urbino-board-grain" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="4" />
        <feColorMatrix values="0 0 0 0 .45  0 0 0 0 .28  0 0 0 0 .12  0 0 0 .55 -.12" />
        <feComposite in2="SourceGraphic" operator="in" result="grain" />
        <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
    </filter>
    <filter id="urbino-piece-grain" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.16" numOctaves="2" seed="9" />
        <feColorMatrix values="0 0 0 0 .4  0 0 0 0 .25  0 0 0 0 .1  0 0 0 .35 -.08" />
        <feComposite in2="SourceGraphic" operator="in" result="grain" />
        <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
    </filter>
    <filter id="urbino-board-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#2a1a08" flood-opacity="0.45" />
    </filter>
    <filter id="urbino-soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" />
    </filter>
    <!-- Sized to the board, since a bounding-box region collapses to nothing for a straight outline segment. -->
    <filter
        id="urbino-glow"
        filterUnits="userSpaceOnUse"
        x={-BOARD_MARGIN}
        y={-BOARD_MARGIN}
        width={BOARD_PIXELS + 2 * BOARD_MARGIN}
        height={BOARD_PIXELS + 2 * BOARD_MARGIN}
    >
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
        </feMerge>
    </filter>
    <radialGradient id="urbino-pawn-body" cx="0.38" cy="0.35" r="0.7">
        <stop offset="0" stop-color="#e34b3c" />
        <stop offset="1" stop-color="#9a1712" />
    </radialGradient>
    <radialGradient id="urbino-pawn-head" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stop-color="#ff7a6a" />
        <stop offset="0.6" stop-color="#d42a1f" />
        <stop offset="1" stop-color="#a51a14" />
    </radialGradient>
</defs>

<rect width={BOARD_PIXELS} height={BOARD_PIXELS} rx="10" fill="#c99a62" filter="url(#urbino-board-shadow)" />
<rect width={BOARD_PIXELS} height={BOARD_PIXELS} rx="10" fill="url(#urbino-board-wood)" filter="url(#urbino-board-grain)" />
<rect
    x="0.5"
    y="0.5"
    width={BOARD_PIXELS - 1}
    height={BOARD_PIXELS - 1}
    rx="10"
    fill="none"
    stroke="#9c6e3e"
    stroke-opacity="0.6"
/>
<rect
    x={frameInset}
    y={frameInset}
    width={BOARD_PIXELS - 2 * frameInset}
    height={BOARD_PIXELS - 2 * frameInset}
    rx="3"
    fill="none"
    stroke="#9c7445"
    stroke-width="1.6"
    stroke-opacity="0.5"
/>
<g stroke-linecap="square">
    {#each grooves as offset (offset)}
        <line x1={gridStart} y1={offset} x2={gridEnd} y2={offset} stroke="#9c7445" stroke-width="2" stroke-opacity="0.55" />
        <line x1={gridStart} y1={offset + 1.5} x2={gridEnd} y2={offset + 1.5} stroke="#fff3da" stroke-opacity="0.35" />
        <line x1={offset} y1={gridStart} x2={offset} y2={gridEnd} stroke="#9c7445" stroke-width="2" stroke-opacity="0.55" />
        <line x1={offset + 1.5} y1={gridStart} x2={offset + 1.5} y2={gridEnd} stroke="#fff3da" stroke-opacity="0.35" />
    {/each}
</g>

<g
    font-family="'Urbino Cinzel', Georgia, serif"
    font-size="13"
    font-weight="700"
    text-anchor="middle"
    dominant-baseline="central"
    pointer-events="none"
>
    {#each lines as line (line)}
        {@const along = BOARD_MARGIN + (line + 0.5) * SQUARE_SIZE}
        {#each [labelOffset, BOARD_PIXELS - labelOffset] as across (across)}
            <text x={along} y={across + 1} fill="#fff1d6" opacity="0.45">{columnName(line)}</text>
            <text x={along} y={across} fill="#8a5f34" opacity="0.8">{columnName(line)}</text>
            <text x={across} y={along + 1} fill="#fff1d6" opacity="0.45">{rowName(line)}</text>
            <text x={across} y={along} fill="#8a5f34" opacity="0.8">{rowName(line)}</text>
        {/each}
    {/each}
</g>
