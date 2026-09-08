<script lang="ts">
    import type { Player } from '@tabletop/common'
    import type { Readable } from 'svelte/store'
    import type { PrivilegedGameViewControls } from '$lib/services/bridges/gameSessionBridge.svelte.js'

    let {
        view,
        actingPlayer
    }: {
        view: PrivilegedGameViewControls
        actingPlayer: Readable<Player | undefined>
    } = $props()

    let isViewingHost = $derived(view.isViewingHost)
    let isViewingAsActingPlayer = $derived(view.isViewingAsActingPlayer)
    let canViewAsActingPlayer = $derived(view.canViewAsActingPlayer)
    let busy = $derived(view.busy)

    function toggleView() {
        view.setActingPlayerPerspectiveEnabled(!$isViewingAsActingPlayer)
    }
</script>

{#if $isViewingHost || $isViewingAsActingPlayer}
    <button
        type="button"
        class="rounded border border-zinc-500 bg-zinc-900 px-2 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={$busy || (!$isViewingAsActingPlayer && !$canViewAsActingPlayer)}
        onclick={toggleView}
    >
        {$isViewingAsActingPlayer
            ? 'View all information'
            : `View as ${$actingPlayer?.name ?? 'Acting Player'}`}
    </button>
{/if}
