<script lang="ts">
    let {
        x = 0,
        y = 0,
        size = 40,
        knownValue
    }: { x?: number; y?: number; size?: number; knownValue?: number } = $props()

    const scale = $derived(size / 40)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <path
        d="M3 3 H37 V21 C37 34 29 41.5 20 45.5 C11 41.5 3 34 3 21 Z"
        fill="#efe4c4"
        stroke="#5b4027"
        stroke-width="1.6"
        stroke-linejoin="round"
    ></path>
    <g transform="translate(8.5 8) scale(0.58)" fill="#2b2118">
        <path d="M2 27 C10 33 30 33 38 26 L35 36 C26 40 12 40 5 36 Z"></path>
        <rect x="18.6" y="2" width="1.8" height="26"></rect>
        <path d="M8 6 C14 5 25 5 31 6 C32 12 32 18 31 23 C25 22 14 22 8 23 C7 18 7 12 8 6 Z"></path>
        <path d="M20.4 1 L28 3.4 L20.4 5.6 Z"></path>
        <path
            d="M0 42 C6 39 10 45 16 42 C22 39 26 45 32 42 C36 40 38 41 40 42"
            fill="none"
            stroke="#2b2118"
            stroke-width="1.6"
        ></path>
    </g>
    {#if knownValue !== undefined}
        <circle cx="31" cy="33" r="8" fill="#2b2118"></circle>
        <text
            x="31"
            y="37.5"
            text-anchor="middle"
            font-family="Libre Baskerville"
            font-style="italic"
            font-weight="700"
            font-size="11"
            fill="#f6e7b8">{knownValue}</text
        >
    {/if}
</g>
