<script lang="ts">
    import type { Snippet } from 'svelte'

    let {
        children,
        justify = 'center'
    }: { children: Snippet; justify?: 'center' | 'left' | 'right' } = $props()

    let wrapperWidth = $state(0)
    let wrapperHeight = $state(0)

    let wrapper: HTMLElement
    let content: HTMLElement

    $effect(() => {
        performScale(wrapperWidth, wrapperHeight)
    })

    function performScale(wrapperWidth: number, wrapperHeight: number) {
        // Get the scaled content, and reset its scaling for an instant
        content.style.transform = 'scale(1, 1)'
        let { width: cw, height: ch } = content.getBoundingClientRect()
        let scaleAmtX = Math.min(wrapperWidth / cw, wrapperHeight / ch)
        let scaleAmtY = scaleAmtX
        content.style.transform = `scale(${scaleAmtX}, ${scaleAmtY})`
    }

    let origin = $derived.by(() => {
        switch (justify) {
            case 'center':
                return 'origin-top'
            case 'left':
                return 'origin-top-left'
            case 'right':
                return 'origin-top-right'
        }
    })
</script>

<div
    bind:this={wrapper}
    bind:clientWidth={wrapperWidth}
    bind:clientHeight={wrapperHeight}
    class="w-full h-full flex justify-{justify}"
>
    <div bind:this={content} class="{origin} box-border w-fit h-fit">
        {@render children()}
    </div>
</div>
