<script lang="ts">
    import { range } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import type { CampaignState } from '@tabletop/oath'
    import DefenseDice from '$lib/components/DefenseDice.svelte'
    import { attackFaceImage } from '$lib/images/diceImages.js'
    import { attackFaceWords } from '$lib/model/diceWords.js'
    import { plural } from '$lib/model/names.js'

    // R-5.5.3 pools while the defender answers, then R-5.5.4 and R-5.5.5 faces and totals.
    // R-5.5.4-H1 — while the defender may reroll, the defense is rolled and the attack waits.
    let { campaign }: { campaign: CampaignState } = $props()

    let unrolled = $derived(!!campaign.pendingDefenderPlans)
    let attackHeld = $derived(!!campaign.pendingAttackRoll)
</script>

{#snippet unrolledDice(count: number, side: 'attack' | 'defense')}
    {#each range(0, count) as index (index)}
        <span
            class="die die--unrolled"
            class:die--attack={side === 'attack'}
            class:die--defense={side === 'defense'}
        ></span>
    {/each}
{/snippet}

<section class="campaign-dice mb-2" aria-label="the Campaign's dice">
    <!-- "vs", not a verb: `PlayerName` prints "you" for the viewer. -->
    <div class="text-[11px] uppercase tracking-[0.2em] text-oath-danger mb-1">
        <PlayerName playerId={campaign.attackerPlayerId} /> vs
        {#if campaign.defenderPlayerId}<PlayerName playerId={campaign.defenderPlayerId} />{:else}the
            bandits{/if}
    </div>
    <div class="dice">
        {#if unrolled}
            <!-- No totals until the roll; each slot keeps a total's room, so the row does not move. -->
            {@render unrolledDice(campaign.attackPool, 'attack')}
            <span class="dice__total dice__total--unrolled"></span>
            <span class="dice__sep"></span>
            {@render unrolledDice(campaign.defensePool, 'defense')}
            <span class="dice__total dice__total--unrolled"></span>
        {:else}
            {#if attackHeld}
                <!-- The dice that will be rolled, with no total yet. -->
                {@render unrolledDice(campaign.attackPool, 'attack')}
                <span class="dice__total dice__total--unrolled"></span>
            {:else}
                {#each campaign.attackRoll as face, index (index)}
                    <span class="die">
                        <img src={attackFaceImage(face)} alt={attackFaceWords(face)} />
                    </span>
                {/each}
                <span class="dice__total">{plural(campaign.swords, 'sword')}</span>
            {/if}
            <span class="dice__sep"></span>
            <DefenseDice faces={campaign.defenseRoll} />
            <span class="dice__total">{campaign.defense} defense</span>
        {/if}
    </div>
</section>

<style>
    .dice {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }
    .die {
        display: block;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        overflow: hidden;
        line-height: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .die img {
        display: block;
        width: 100%;
        height: 100%;
    }
    .die--unrolled {
        border: 2px dashed rgba(255, 255, 255, 0.45);
        opacity: 0.75;
    }
    .die--attack {
        background: #d64e0c;
    }
    .die--defense {
        background: #0a8fd6;
    }
    .dice__sep {
        width: 10px;
    }
    .dice__total {
        margin-left: 4px;
        font-size: 13px;
        color: var(--oath-text-muted);
        white-space: nowrap;
    }
    .dice__total--unrolled {
        min-width: 4.5em;
        min-height: 1.5em;
    }
</style>
