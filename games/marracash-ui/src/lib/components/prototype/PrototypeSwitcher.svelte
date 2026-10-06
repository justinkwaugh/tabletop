<script lang="ts">
    // PROTOTYPE: floating variant switcher, dev builds only.
    let {
        variants,
        current,
        onchange
    }: {
        variants: { key: string; label: string }[]
        current: string
        onchange: (key: string) => void
    } = $props()

    let index = $derived(
        Math.max(
            0,
            variants.findIndex((variant) => variant.key === current)
        )
    )

    function step(delta: number) {
        onchange(variants[(index + delta + variants.length) % variants.length].key)
    }

    function onkeydown(event: KeyboardEvent) {
        const target = event.target as HTMLElement | null
        if (target?.closest('input, textarea, [contenteditable]')) return
        if (event.key === 'ArrowLeft') step(-1)
        if (event.key === 'ArrowRight') step(1)
    }
</script>

<svelte:window {onkeydown} />

{#if import.meta.env.DEV}
    <div
        class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-fuchsia-600 px-3 py-1.5 font-sans text-sm text-white shadow-xl"
    >
        <button type="button" class="px-2" onclick={() => step(-1)}>◀</button>
        <span class="min-w-48 text-center"
            >{variants[index].key} ({variants[index].label}) · {index + 1}/{variants.length}</span
        >
        <button type="button" class="px-2" onclick={() => step(1)}>▶</button>
    </div>
{/if}
