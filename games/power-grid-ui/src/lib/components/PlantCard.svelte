<script lang="ts">
    import { plantImage, STEP_3_IMAGE } from '$lib/utils/plantImages.js'

    let {
        plant,
        size = 120,
        dimmed = false,
        selected = false,
        targetable = false,
        onclick,
        children
    }: {
        plant: number | 'step3'
        size?: number
        dimmed?: boolean
        selected?: boolean
        targetable?: boolean
        onclick?: () => void
        children?: import('svelte').Snippet
    } = $props()

    const src = $derived(plant === 'step3' ? STEP_3_IMAGE : plantImage(plant))
    const label = $derived(plant === 'step3' ? 'Step 3' : `Power plant ${plant}`)
</script>

{#if onclick}
    <button
        type="button"
        class="card"
        class:dimmed
        class:selected
        class:targetable
        style:width="{size}px"
        style:height="{size}px"
        aria-label={label}
        aria-pressed={selected}
        {onclick}
    >
        <img {src} alt={label} draggable="false" />
        {@render children?.()}
    </button>
{:else}
    <div class="card" class:dimmed class:selected style:width="{size}px" style:height="{size}px">
        <img {src} alt={label} draggable="false" />
        {@render children?.()}
    </div>
{/if}

<style>
    .card {
        position: relative;
        display: block;
        flex: none;
        border-radius: 8%;
        padding: 0;
        background: #6f6a72;
        box-shadow: 0 2px 4px rgb(0 0 0 / 0.45);
        transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            filter 120ms ease;
    }
    .card img {
        width: 100%;
        height: 100%;
        border-radius: 8%;
        display: block;
    }
    .dimmed {
        filter: grayscale(0.7) brightness(0.7);
    }
    .targetable {
        cursor: pointer;
        outline: 3px dashed #f3c534;
        outline-offset: 2px;
    }
    .targetable:hover {
        transform: translateY(-3px);
        outline-style: solid;
    }
    .selected {
        outline: 4px solid #f3c534;
        outline-offset: 2px;
        transform: translateY(-4px);
    }
</style>
