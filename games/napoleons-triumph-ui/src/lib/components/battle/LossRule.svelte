<script lang="ts">
    import { Side } from '@tabletop/napoleons-triumph'
    import SwelledRule from '$lib/components/SwelledRule.svelte'
    import { lossSummary, type AttackLosses } from '$lib/model/attackLosses.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LossAccount from './LossAccount.svelte'

    let { losses }: { losses: AttackLosses } = $props()

    const gameSession = getGameSession()

    const ARMIES: Record<Side, string> = {
        [Side.French]: 'French',
        [Side.Allied]: 'Allies'
    }

    let explaining = $state(false)
</script>

{#snippet words()}
    <button
        type="button"
        class="nt-loss-rule-words"
        aria-haspopup="dialog"
        onclick={() => (explaining = true)}
    >
        {#each [losses.attacker, losses.defender] as side, index (side.playerId)}
            {#if index > 0}
                <svg viewBox="0 0 10 10" aria-hidden="true"
                    ><path d="M5 0 L10 5 L5 10 L0 5 Z"></path></svg
                >
            {/if}
            <span
                >{ARMIES[gameSession.gameState.sideOf(side.playerId)]}
                <b>{lossSummary(side)}</b></span
            >
        {/each}
    </button>
{/snippet}

<div class="nt-loss-rule">
    <SwelledRule>{@render words()}</SwelledRule>
</div>
{#if explaining}
    <LossAccount {losses} onclose={() => (explaining = false)} />
{/if}

<style>
    .nt-loss-rule {
        max-width: 60ch;
        padding: 2px 0;
    }

    .nt-loss-rule-words {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-style: italic;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
    }

    .nt-loss-rule-words span {
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 4px;
    }

    .nt-loss-rule-words:hover span {
        text-decoration-style: solid;
    }

    b {
        font-style: normal;
    }

    svg {
        width: 7px;
        height: 7px;
        fill: currentColor;
        opacity: 0.78;
    }

    @media (max-width: 639px) {
        .nt-loss-rule-words {
            gap: 7px;
            font-size: 13px;
        }
    }
</style>
