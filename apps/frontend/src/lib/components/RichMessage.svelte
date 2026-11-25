<script lang="ts">
    import type { Snippet } from 'svelte'
    import { assertExists, messageSegments, type MessagePart } from '@tabletop/common'

    let { parts, markup }: { parts: MessagePart[]; markup: Record<string, Snippet<[string]>> } =
        $props()

    const segments = $derived(messageSegments(parts))

    function markupFor(name: string): Snippet<[string]> {
        const snippet = markup[name]
        assertExists(snippet, `No snippet renders the message markup {#${name}}`)
        return snippet
    }
</script>

{#each segments as segment, index (index)}{#if segment.type === 'text'}{segment.text}{:else}{@render markupFor(
            segment.name
        )(segment.text)}{/if}{/each}
