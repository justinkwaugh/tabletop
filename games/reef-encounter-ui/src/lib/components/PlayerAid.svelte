<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import ReferenceCard from '$lib/images/reference-card.jpg'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

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
        event.preventDefault()
        gameSession.closePlayerAid()
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="backdrop" role="presentation" onclick={() => gameSession.closePlayerAid()}>
    <div
        class="aid"
        role="dialog"
        aria-label="Player aid"
        tabindex="-1"
        {@attach holdFocus}
        onclick={(event) => event.stopPropagation()}
        onkeydown={closeOnEscape}
    >
        <img
            src={ReferenceCard}
            width="800"
            height="1149"
            alt="Reference card. In a turn: first, 1, eat one coral and a shrimp. Then in any order: 2, play a larva cube and polyp tiles; 3, play a second larva cube and polyp tiles; 4, introduce a shrimp; 5, move a shrimp; 6, exchange a consumed polyp tile for a larva cube of the same colour; 7, acquire and play an alga cylinder; 8, exchange a larva cube for a polyp tile of the same colour; 9, do none of the above. Last, 10, collect a larva cube and polyp tiles."
        />
    </div>
</div>

<style>
    .backdrop {
        position: absolute;
        inset: 0;
        z-index: 40;
        display: flex;
        padding: 12px;
        background: rgb(13 34 30 / 0.5);
        container-type: size;
    }

    .aid {
        margin: auto;
        outline: none;
    }

    img {
        display: block;
        width: auto;
        height: auto;
        max-width: min(400px, 100cqw);
        max-height: 100cqh;
        border-radius: 12px;
        box-shadow: 0 8px 28px rgb(0 0 0 / 0.45);
    }
</style>
