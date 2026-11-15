<script lang="ts">
    import { tick } from 'svelte'
    import { flip } from 'svelte/animate'
    import type { Color } from '@tabletop/common'
    import { moveToIndex } from '@tabletop/frontend-components'

    let {
        colors,
        swatchClass,
        onchange
    }: {
        colors: Color[]
        swatchClass: (color: Color) => string
        onchange: (colors: Color[]) => void
    } = $props()

    const hintId = $props.id()
    let row: HTMLDivElement
    const swatches: Partial<Record<Color, HTMLButtonElement>> = {}
    let dragged: Color | undefined = $state(undefined)
    let slotCenters: number[] = []

    // Slots come from layout positions, which the flip animation's transforms leave alone, so a
    // swatch still sliding into place is never mistaken for the one under the pointer.
    function measureSlots() {
        slotCenters = colors.map((color) => {
            const swatch = swatches[color]
            return swatch ? swatch.offsetLeft + swatch.offsetWidth / 2 : 0
        })
    }

    function slotAt(clientX: number): number {
        const x = clientX - row.getBoundingClientRect().left
        let nearest = 0
        slotCenters.forEach((center, index) => {
            if (Math.abs(center - x) < Math.abs(slotCenters[nearest] - x)) nearest = index
        })
        return nearest
    }

    function moveTo(color: Color, index: number) {
        const reordered = moveToIndex(colors, color, index)
        if (reordered.some((other, i) => other !== colors[i])) onchange(reordered)
    }

    function startDrag(event: PointerEvent, color: Color) {
        if (event.button !== 0) return
        measureSlots()
        dragged = color
        row.setPointerCapture(event.pointerId)
    }

    function continueDrag(event: PointerEvent) {
        if (dragged) moveTo(dragged, slotAt(event.clientX))
    }

    function finishDrag() {
        dragged = undefined
    }

    async function moveWithKeys(event: KeyboardEvent, color: Color, index: number) {
        const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
        if (step === 0) return
        event.preventDefault()
        moveTo(color, index + step)
        // Reordering moves the swatch's element, which drops keyboard focus.
        await tick()
        swatches[color]?.focus()
    }
</script>

<div class="flex flex-col items-center">
    <div
        bind:this={row}
        role="group"
        aria-label="Preferred player colours"
        aria-describedby={hintId}
        class="relative flex select-none flex-row items-center justify-center gap-1"
        onpointermove={continueDrag}
        onpointerup={finishDrag}
        onpointercancel={finishDrag}
        onlostpointercapture={finishDrag}
    >
        {#each colors as color, i (color)}
            <button
                bind:this={swatches[color]}
                type="button"
                aria-label={`${color}, ${i + 1} of ${colors.length}`}
                onpointerdown={(event) => startDrag(event, color)}
                onkeydown={(event) => moveWithKeys(event, color, i)}
                animate:flip={{ duration: 100 }}
                class="h-[40px] w-[26px] touch-none rounded-lg border-2 border-gray-800 {swatchClass(
                    color
                )}"
                class:dragged={dragged === color}
            ></button>
        {/each}
    </div>
    <p id={hintId} class="mt-2 text-xs font-medium text-gray-400">
        drag, or use the arrow keys, to reorder
    </p>
</div>

<style>
    button {
        cursor: grab;
    }
    button:focus-visible {
        outline: 2px solid var(--color-blue-400);
        outline-offset: 2px;
    }
    .dragged {
        cursor: grabbing;
        outline: 2px solid var(--color-gray-300);
        outline-offset: 1px;
    }
</style>
