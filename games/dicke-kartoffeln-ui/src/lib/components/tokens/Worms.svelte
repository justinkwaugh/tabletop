<script lang="ts">
    import { TOKEN_IMAGES, wormTiles } from '$lib/utils/tokens.js'
    import ImageTile from './ImageTile.svelte'

    let { count, size, pending = 0 }: { count: number; size: number; pending?: number } = $props()

    const settled = $derived(wormTiles(count))
    const arriving = $derived(wormTiles(pending))
</script>

<div class="worms" style:gap="{size * 0.06}px">
    {#each settled as tile, index (index)}
        <ImageTile
            src={tile === 'pair' ? TOKEN_IMAGES.worms : TOKEN_IMAGES.worm}
            alt={tile === 'pair' ? 'Two worms' : 'Worm'}
            {size}
            width={tile === 'pair' ? size * 0.78 : size * 0.48}
        />
    {/each}
    {#each arriving as tile, index (index)}
        <ImageTile
            src={tile === 'pair' ? TOKEN_IMAGES.worms : TOKEN_IMAGES.worm}
            alt="Worms to come"
            {size}
            width={tile === 'pair' ? size * 0.78 : size * 0.48}
            pending
        />
    {/each}
</div>

<style>
    .worms {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: center;
    }
</style>
