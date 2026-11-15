<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()

    const settlementId = $derived(gameSession.settlementChoice)
    const target = $derived(
        gameSession.developTargets.find((candidate) => candidate.settlementId === settlementId)
    )
    const name = $derived(
        settlementId ? gameSession.gameState.map.settlement(settlementId).name : undefined
    )
</script>

<!-- A settlement that may be developed or left asks which beside it. It stays open until the
     player chooses, picks another settlement, or presses Undo, so Undo never reaches past it. -->
{#if settlementId && target && name}
    {#key settlementId}
        <Floater placement="right" trigger="manual" reference="#sar-settlement-{settlementId}">
            <div class="picker" role="group" aria-label={name}>
                <div class="title">{name}</div>
                <button
                    type="button"
                    class="primary"
                    onclick={() => gameSession.develop(settlementId)}
                    >Develop · {target.cost > 0 ? `$${target.cost}` : 'free'}</button
                >
                <button
                    type="button"
                    class="secondary"
                    onclick={() => gameSession.leaveTown(settlementId)}
                    >Leave Town · take its cube</button
                >
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
        border: 2px solid #1f2d3d;
        border-radius: 12px;
        background: #fdfdfb;
        padding: 8px 10px;
        box-shadow: 0 2px 6px rgba(16, 22, 30, 0.18);
        color: #1f2d3d;
    }

    .title {
        font-family: 'SAR Baskerville', Georgia, serif;
        font-size: 15px;
        font-style: italic;
        font-weight: 700;
        text-align: center;
    }
</style>
