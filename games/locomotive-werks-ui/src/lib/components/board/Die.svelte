<script lang="ts">
    // A black Chessex d6: rounded black body, white pips, a lighter rim for its bevel.
    let { x, y, size, face }: { x: number; y: number; size: number; face: number } = $props()

    const PIPS: Record<number, [number, number][]> = {
        1: [[0, 0]],
        2: [
            [-1, -1],
            [1, 1]
        ],
        3: [
            [-1, -1],
            [0, 0],
            [1, 1]
        ],
        4: [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
        ],
        5: [
            [-1, -1],
            [1, -1],
            [0, 0],
            [-1, 1],
            [1, 1]
        ],
        6: [
            [-1, -1],
            [1, -1],
            [-1, 0],
            [1, 0],
            [-1, 1],
            [1, 1]
        ]
    }

    const corner = $derived(size * 0.2)
    const spread = $derived(size * 0.27)
    const pip = $derived(size * 0.095)
</script>

<g transform="translate({x} {y})" aria-label="Die showing {face}">
    <rect
        x={-size / 2 + 1.5}
        y={-size / 2 + 2.5}
        width={size}
        height={size}
        rx={corner}
        fill="#2a333b"
        fill-opacity="0.35"
    ></rect>
    <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={corner} fill="#121212"></rect>
    <rect
        x={-size / 2 + 1}
        y={-size / 2 + 1}
        width={size - 2}
        height={size - 2}
        rx={corner - 1}
        fill="none"
        stroke="#4a4a4a"
        stroke-width="1.4"
    ></rect>
    <rect
        x={-size / 2 + size * 0.12}
        y={-size / 2 + size * 0.12}
        width={size * 0.76}
        height={size * 0.76}
        rx={corner * 0.7}
        fill="#1b1b1b"
    ></rect>
    {#each PIPS[face] ?? [] as [px, py], index (index)}
        <circle cx={px * spread} cy={py * spread} r={pip} fill="#f3f5f7"></circle>
    {/each}
</g>
