<script lang="ts">
    import { possiblePartners, type PactOpening } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PactEditor from './PactEditor.svelte'

    let { opening }: { opening: PactOpening } = $props()

    const gameSession = getGameSession()
    const partners = $derived(
        possiblePartners(gameSession.gameState, gameSession.myPlayerId ?? '', opening)
    )
    const draft = $derived.by(() => {
        const current = gameSession.pactDraft
        return current &&
            current.counteredPactId === undefined &&
            current.opening.targetId === opening.targetId &&
            current.opening.challenge === opening.challenge
            ? current
            : undefined
    })
</script>

{#if partners.length > 0}
    <div class="pact-offer">
        <button
            type="button"
            aria-pressed={draft !== undefined}
            class:on={draft !== undefined}
            onclick={() => gameSession.openPactDraft(opening)}>Propose a pact</button
        >
        <span class="hint">Resolve it together with another faction, splitting the reward.</span>
    </div>
    {#if draft}
        <PactEditor {draft} />
    {/if}
{/if}

<style>
    .pact-offer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .hint {
        font-size: 12.5px;
        color: #8fa4c2;
    }

    button.on {
        border-color: #7fd3ff;
        background: #18324f;
    }
</style>
