<script lang="ts">
    import { LetPeekSubjectKind, type LetPeekSubject } from '@tabletop/oath'
    import { cardName, reliquaryLabel } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.1, R-9.4, R-6.6.1 — what the player may show, and to whom.
    let gameSession = getGameSession()
    let shows = $derived(gameSession.letPeekShows)
    let busy = $derived(gameSession.busy)

    function subjectLabel(subject: LetPeekSubject): string {
        return subject.kind === LetPeekSubjectKind.Adviser
            ? cardName(subject.cardId)
            : `the relic on ${reliquaryLabel(subject.slotId)}`
    }

    function subjectKey(subject: LetPeekSubject): string {
        return subject.kind === LetPeekSubjectKind.Adviser ? subject.cardId : subject.slotId
    }
</script>

{#each shows as show (subjectKey(show.subject))}
    <div class="text-xs text-oath-text-muted">Show {subjectLabel(show.subject)} to</div>
    <div class="flex flex-wrap gap-1 mb-1">
        {#each show.toPlayerIds as toPlayerId (toPlayerId)}
            <button
                class="rounded border border-oath-frame bg-oath-surface-raised hover:border-oath-accent px-2 py-1 text-xs"
                disabled={busy}
                onclick={() => gameSession.letPeek(show.subject, toPlayerId)}
            >
                {gameSession.getPlayerName(toPlayerId)}
            </button>
        {/each}
    </div>
{/each}
