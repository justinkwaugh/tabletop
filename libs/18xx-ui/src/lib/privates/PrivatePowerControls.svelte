<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import PrivateExchangeButton from './PrivateExchangeButton.svelte'

    let { session }: { session: EighteenXXSession } = $props()
    const gameState = $derived(session.gameState)
    const options = $derived(
        session.privates.allExchangeOptions.filter(
            (option) =>
                gameState.machineState !== 'StockRound' ||
                !gameState.activePlayerIds.includes(option.playerId)
        )
    )
    const actors = $derived(new Set(options.map((option) => option.playerId)))
</script>

{#if options.length}
    <div class="private-powers" role="group" aria-label="Private powers">
        {#each options as option (`${option.playerId}:${option.privateCompanyId}:${option.certificateId}`)}
            <span class="power">
                <span class="name"
                    >{actors.size > 1 || option.playerId !== session.myPlayer?.id
                        ? `${session.getPlayerName(option.playerId)} · `
                        : ''}{getCompany(gameState, option.privateCompanyId).name}</span
                >
                <PrivateExchangeButton {session} {option} />
            </span>
        {/each}
    </div>
{/if}

<style>
    .private-powers {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px 18px;
        padding: 5px 12px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #514538);
        font-size: 12px;
    }
    .power {
        display: inline-flex;
        align-items: center;
        gap: 7px;
    }
    .name {
        font-weight: 500;
    }
</style>
