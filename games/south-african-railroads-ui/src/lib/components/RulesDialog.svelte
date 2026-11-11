<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import type { Attachment } from 'svelte/attachments'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)
    const layout = $derived(boardLayout(map.id))
    const special = $derived(map.definition.specialConnection)
    const notes = $derived([
        ...(layout.spec.rules?.notes ?? []).map((lines) => lines.join(' ')),
        ...(special
            ? [
                  `The ${special.name}: once a game, in place of a build, a railroad of ${names(special.northern)} whose track meets one of ${names(special.southern)} pays $${special.cost} to found it. Both pay a special dividend and gain $${special.valueBonus} final value.`
              ]
            : [])
    ])

    function names(railroadIds: readonly RailroadId[]): string {
        return railroadIds.map((railroadId) => map.railroad(railroadId).shortName).join(' or ')
    }

    const holdFocus: Attachment<HTMLElement> = (dialog) => {
        const opener = document.activeElement
        dialog.focus()
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
        }
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (event.key !== 'Escape') return
        event.preventDefault()
        gameSession.closeRules()
    }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="backdrop" role="presentation" onclick={() => gameSession.closeRules()}>
    <div
        class="sheet"
        role="dialog"
        aria-label="{layout.spec.title} rules"
        tabindex="-1"
        {@attach holdFocus}
        onclick={(event) => event.stopPropagation()}
        onkeydown={closeOnEscape}
    >
        <button
            type="button"
            class="close"
            aria-label="Close the rules"
            onclick={() => gameSession.closeRules()}>×</button
        >
        <h2>{layout.spec.title} Rules</h2>
        <p class="subtitle">where they differ from South African Railroads</p>
        <ul>
            {#each notes as note, index (index)}
                <li>{note}</li>
            {/each}
        </ul>
    </div>
</div>

<style>
    .backdrop {
        position: absolute;
        inset: 0;
        z-index: 40;
        overflow: auto;
        background: rgba(16, 22, 30, 0.45);
        padding: 12px;
    }

    .sheet {
        position: relative;
        max-width: 720px;
        margin: 0 auto;
        border: 2px solid #384f6c;
        border-radius: 12px;
        background: #f7efd9;
        padding: 20px 28px 22px;
        box-shadow: 0 4px 14px rgba(16, 22, 30, 0.35);
        outline: none;
        color: #18222f;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        line-height: 1.5;
    }

    .close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        background: #1f2d3d;
        color: #fdfdfb;
        font-size: 22px;
        line-height: 1;
    }

    h2 {
        margin-right: 36px;
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 24px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-align: center;
    }

    .subtitle {
        border-bottom: 1px solid #577ba8;
        padding-bottom: 8px;
        color: #2f445c;
        font-size: 13px;
        font-style: italic;
        text-align: center;
    }

    ul {
        margin-top: 12px;
        padding-left: 20px;
        list-style: disc;
    }

    li + li {
        margin-top: 8px;
    }

    @media (max-width: 639px) {
        .sheet {
            padding: 14px 16px 16px;
            font-size: 13px;
        }

        h2 {
            font-size: 19px;
        }
    }
</style>
