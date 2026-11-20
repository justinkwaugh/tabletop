<script lang="ts">
    import { CalledGameDescription } from '@tabletop/frontend-components'
    import type { HistoryEntry } from '$lib/history/historyEntries.js'
    import { entrySegments } from '$lib/history/entryText.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import MarbleIcon from './MarbleIcon.svelte'

    let { entry, brief = false }: { entry: HistoryEntry; brief?: boolean } = $props()

    const session = getGameSession()

    const move = $derived(entry.kind === 'call' ? undefined : entry)
    const isMe = $derived(move?.playerId === session.myPlayer?.id)
    const name = $derived.by(() => {
        if (move === undefined) return ''
        return isMe ? 'You' : session.getPlayerName(move.playerId)
    })
    const segments = $derived(move ? entrySegments(move, isMe, brief) : [])
</script>

{#if entry.kind === 'call'}
    <span><CalledGameDescription action={entry.action} /></span>
{:else}
    <span
        ><span class="font-semibold">{name}</span
        >{#each segments as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'marble'}<span
                    class="marble"
                    ><MarbleIcon color={segment.color} seed={segment.seed} size={14} /></span
                >{:else if segment.kind === 'ring'}<span class="coordinate"
                    >{session.notation.name(segment.coords)}</span
                >{:else}<span class="step">→</span>{/if}{/each}</span
    >
{/if}

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
