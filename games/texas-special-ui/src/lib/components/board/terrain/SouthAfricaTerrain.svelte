<script lang="ts">
    const SEA =
        'M1584 640 C1566 742 1540 832 1528 904 C1516 980 1522 1040 1540 1100 L1556 1224 L1584 1224 Z'
    const WAVE_OFFSETS = [10, 22, 34]
</script>

<defs>
    <linearGradient id="sar-sea" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#9fc7cf" />
        <stop offset="100%" stop-color="#6fa5b3" />
    </linearGradient>
</defs>

<path d={SEA} fill="url(#sar-sea)" />
<path d={SEA} fill="none" stroke="#4f7f8c" stroke-width="2" />
{#each WAVE_OFFSETS as offset (offset)}
    <path
        d="M{1584 - 4} {640 + offset * 2} C{1566 + offset} {742 + offset} {1540 + offset} {832 +
            offset} {1528 + offset} {904 + offset}"
        fill="none"
        stroke="#e4f1f3"
        stroke-width="1.2"
        stroke-dasharray="6 9"
        opacity="0.7"
    />
{/each}
<text x="1556" y="770" class="sea-label" transform="rotate(-80 1556 770)">INDIAN OCEAN</text>

<style>
    .sea-label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-style: italic;
        letter-spacing: 0.4em;
        fill: #eef6f7;
        text-anchor: middle;
        pointer-events: none;
    }
</style>
