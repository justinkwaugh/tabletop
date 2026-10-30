<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { RailroadId } from '@tabletop/promontory-point'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import type { DescriptionPart } from '$lib/utils/actionDescription.js'

    let { parts }: { parts: readonly DescriptionPart[] } = $props()

    // The railroad's own token; Southern Pacific's light yellow takes dark ink.
    function tagStyle(railroadId: RailroadId): string {
        const token = `--pp-${RAILROAD_TAGS[railroadId].toLowerCase()}`
        const ink = railroadId === 'railroad.sp' ? 'var(--pp-ink)' : 'var(--pp-rr-ink)'
        return `background: var(${token}); color: ${ink};`
    }
</script>

{#each parts as part, index (index)}
    {#if part.kind === 'text'}{part.text}{:else if part.kind === 'railroad'}<span
            class="tag"
            style={tagStyle(part.railroadId)}>{RAILROAD_TAGS[part.railroadId]}</span
        >{:else}<PlayerName playerId={part.playerId} capitalization="none" />{/if}
{/each}

<style>
    .tag {
        display: inline-block;
        padding: 0 4px;
        border-radius: 4px;
        font-family: 'Oswald', sans-serif;
        font-size: 0.85em;
        font-weight: 600;
        line-height: 1.35;
        letter-spacing: 0.04em;
    }
</style>
