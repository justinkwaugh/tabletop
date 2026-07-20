<script lang="ts">
    import boardA from '$lib/images/board/board-a.jpg'
    import boardB from '$lib/images/board/board-b.jpg'
    import boardC from '$lib/images/board/board-c.jpg'
    import boardD from '$lib/images/board/board-d.jpg'
    import boardE from '$lib/images/board/board-e.jpg'
    import boardF from '$lib/images/board/board-f.jpg'

    const boardImages = [boardA, boardB, boardC, boardD, boardE, boardF]
    const rotations = [0, 90, 180, 270]

    function shuffle<T>(items: T[]): T[] {
        const result = [...items]
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
    }

    const tiles = shuffle(boardImages).map((src) => ({
        src,
        rotation: rotations[Math.floor(Math.random() * rotations.length)]
    }))
</script>

<div class="grid grid-cols-3 grid-rows-2 w-full aspect-[3/2] bg-black">
    {#each tiles as tile, i (i)}
        <div class="overflow-hidden">
            <img
                src={tile.src}
                alt="board tile"
                class="w-full h-full object-cover"
                style="transform: rotate({tile.rotation}deg)"
            />
        </div>
    {/each}
</div>
