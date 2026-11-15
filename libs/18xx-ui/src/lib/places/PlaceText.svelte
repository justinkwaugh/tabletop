<script lang="ts">
    import type { Snippet } from 'svelte'
    import { placeTextSegments } from '@tabletop/18xx'
    import PlaceLink from './PlaceLink.svelte'

    let { text, plain }: { text: string; plain?: Snippet<[string]> } = $props()

    const segments = $derived(placeTextSegments(text))
</script>

{#each segments as segment, index (index)}{#if 'locationId' in segment}<PlaceLink
            locationId={segment.locationId}
        />{:else if plain}{@render plain(segment.text)}{:else}{segment.text}{/if}{/each}
