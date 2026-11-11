<script lang="ts">
    import type { Game } from '@tabletop/common'
    import { toast } from 'svelte-sonner'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import type { LobbyEntry } from '$lib/utils/seriesLobby'

    let { game, entry }: { game: Game; entry: LobbyEntry } = $props()
    const { gameService } = getAppContext()
    let joining = $state(false)

    const LABELS: Record<Exclude<LobbyEntry, 'join' | 'joined' | 'full'>, string> = {
        yourTurn: 'Your Turn',
        enter: 'Enter',
        watch: 'Watch',
        revisit: 'Revisit'
    }

    async function join() {
        joining = true
        try {
            await gameService.joinGame(game.id)
        } catch {
            toast.error('Unable to join this game. Please try again.')
        } finally {
            joining = false
        }
    }
</script>

{#if entry === 'join'}
    <button
        class="entry join"
        disabled={joining}
        aria-busy={joining}
        aria-label={`Join ${game.name}`}
        onclick={join}>Join</button
    >
{:else if entry === 'joined' || entry === 'full'}
    <span class="joined">{entry === 'joined' ? 'Joined' : 'Full'}</span>
{:else}
    <a class="entry {entry}" href={`/game/${game.id}`} aria-label={`${LABELS[entry]}: ${game.name}`}
        >{LABELS[entry]}</a
    >
{/if}

<style>
    .entry {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 6px;
        background: var(--color-blue-600);
        color: white;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        transition: background-color 150ms;
    }
    .entry:hover {
        background: var(--color-blue-700);
    }
    .entry.join {
        background: var(--color-green-600);
    }
    .entry.join:hover {
        background: var(--color-green-700);
    }
    .entry.join:disabled {
        opacity: 0.6;
    }
    .entry.yourTurn {
        background: var(--color-yellow-600);
    }
    .entry.yourTurn:hover {
        background: var(--color-yellow-700);
    }
    .entry.revisit {
        background: var(--color-gray-700);
        color: var(--color-gray-200);
    }
    .entry.revisit:hover {
        background: var(--color-gray-600);
    }
    .entry:focus-visible {
        outline: 2px solid var(--color-blue-300);
        outline-offset: 2px;
    }
    .joined {
        color: var(--color-gray-400);
        font-size: 12px;
    }
</style>
