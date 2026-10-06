<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TurnAid from '$lib/components/TurnAid.svelte'
    import MoneyAid from '$lib/components/MoneyAid.svelte'
    import AntiqueAid from '$lib/components/AntiqueAid.svelte'

    const gameSession = getGameSession()

    const holdFocus: Attachment<HTMLElement> = (aid) => {
        const opener = document.activeElement
        aid.focus()
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape') return
        // Keeps a full-screen board open: Escape there would otherwise also cancel its dialog
        event.preventDefault()
        event.stopPropagation()
        gameSession.closePlayerAid()
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div
    class="absolute inset-0 z-40 flex overflow-auto p-3"
    role="presentation"
    onclick={() => gameSession.closePlayerAid()}
>
    <div
        class="m-auto flex max-w-full flex-wrap items-start justify-center gap-3.5 outline-none"
        role="dialog"
        aria-label="Player aid"
        tabindex="-1"
        {@attach holdFocus}
        onclick={(event) => event.stopPropagation()}
        onkeydown={closeOnEscape}
    >
        <TurnAid />
        <MoneyAid />
        {#if gameSession.gameState.antiqueCards}
            <AntiqueAid />
        {/if}
    </div>
</div>
