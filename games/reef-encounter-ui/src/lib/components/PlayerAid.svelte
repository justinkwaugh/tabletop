<script lang="ts">
    import type { Attachment } from 'svelte/attachments'
    import ReferenceCard from '$lib/images/reference-card.webp'
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
        <button
            class="close reef-display"
            aria-label="Close the player aid"
            onclick={() => gameSession.closePlayerAid()}>×</button
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
        position: relative;
        margin: auto;
        outline: none;
    }

    .close {
        display: none;
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

    @media (max-width: 639px) {
        .backdrop {
            position: fixed;
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
                env(safe-area-inset-left);
            /* The card's own water, so the screen reads as one card. */
            background: rgb(145 189 171);
        }

        img {
            max-width: 100cqw;
            border-radius: 0;
            box-shadow: none;
            mask-image: linear-gradient(transparent, black 3%, black 97%, transparent);
        }

        .close {
            position: fixed;
            top: calc(env(safe-area-inset-top) + 10px);
            right: calc(env(safe-area-inset-right) + 10px);
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            border-radius: 999px;
            font-size: 24px;
            line-height: 1;
            color: var(--reef-paper-ink);
            background: rgb(255 255 255 / 0.85);
            box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
        }
    }
</style>
