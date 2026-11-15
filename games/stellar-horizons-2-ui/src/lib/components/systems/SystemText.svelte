<script lang="ts">
    import { systemTextSegments } from '$lib/utils/systemText.js'
    import SystemLink from './SystemLink.svelte'

    // Text whose system references (`systemRef`) are shown as links into the map.
    let { text }: { text: string } = $props()

    const segments = $derived(systemTextSegments(text))
</script>

{#each segments as segment, index (index)}{#if 'systemId' in segment}<SystemLink
            systemId={segment.systemId}
        />{:else}{segment.text}{/if}{/each}
