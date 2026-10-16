<script lang="ts">
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarbleIcon from './MarbleIcon.svelte'

    let { entry }: { entry: HistoryEntry } = $props()

    const session = getGameSession()

    const isMe = $derived(entry.playerId === session.myPlayer?.id)
    const name = $derived(isMe ? 'You' : session.getPlayerName(entry.playerId))
    const segments = $derived(entrySegments(entry, isMe))
</script>

<span
    ><span class="font-semibold">{name}</span
    >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'marble'}<span
                class="marble"><MarbleIcon color={segment.color} size={14} /></span
            >{:else if segment.kind === 'ring'}<span class="coordinate"
                >{session.notation.name(segment.coords)}</span
            >{:else}<span class="step">→</span>{/if}{/each}</span
>

<style>
    .marble {
        display: inline-flex;
        transform: translateY(2px);
        margin: 0 1px;
    }

    .coordinate {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
    }

    .step {
        margin: 0 3px;
        color: var(--zertz-ink-quiet);
    }
</style>
