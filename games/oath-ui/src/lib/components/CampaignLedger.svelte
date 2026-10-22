<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import { attackFaceImage, defenseFaceImage } from '$lib/images/diceImages.js'
    import {
        campaignLedger,
        makeupWords,
        type CampaignLedgerSide
    } from '$lib/model/campaignLedger.js'
    import { attackFaceWords, defenseFaceWords } from '$lib/model/diceWords.js'
    import { seatsById } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.5 — the closing card's ledger: the result, then each side's dice, plans, losses and gains.
    let { steps }: { steps: readonly GameAction[] } = $props()

    let gameSession = getGameSession()

    let ledger = $derived(
        campaignLedger(steps, seatsById(gameSession.historyNames), gameSession.gameState)
    )
    let seats = $derived({ names: gameSession.historyNames, viewerId: gameSession.myPlayer?.id })
    const SHIELD = { shields: 1, doubling: false }
</script>

{#snippet line(label: string, text: string | undefined, side: CampaignLedgerSide)}
    {#if text}
        <dt class="campaign-ledger__label text-oath-text-muted">{label}</dt>
        <dd class="campaign-ledger__value">
            <TokenText
                {text}
                {seats}
                warbandColor={gameSession.ledgerWarbandColor(side.seatId)}
            />
        </dd>
    {/if}
{/snippet}

{#snippet sideRows(side: CampaignLedgerSide)}
    <div class="campaign-ledger__side">
        {#if side.seatId}<PlayerName playerId={side.seatId} />{:else}<span>The bandits</span>{/if}
        <span class="text-xs text-oath-text-muted">{side.role}</span>
    </div>
    <dl class="campaign-ledger__lines">
        <dt class="campaign-ledger__label text-oath-text-muted">Dice</dt>
        <dd class="campaign-ledger__value">
            {side.dice}{#if side.attackFaces || side.defenseFaces}:{/if}
            {#if side.attackFaces}
                <span class="campaign-ledger__dice">
                    {#each side.attackFaces as face, index (index)}
                        <img
                            class="campaign-ledger__die"
                            src={attackFaceImage(face)}
                            alt={attackFaceWords(face)}
                        />
                    {/each}
                </span>
            {/if}
            {#if side.defenseFaces}
                <span class="campaign-ledger__dice">
                    {#each side.defenseFaces as face, index (index)}
                        <img
                            class="campaign-ledger__die"
                            src={defenseFaceImage(face)}
                            alt={defenseFaceWords(face)}
                        />
                    {/each}
                </span>
            {/if}
        </dd>
        {#if side.makeup}
            <dd class="campaign-ledger__value">
                <span class="token-count"
                    >{side.makeup.shields}<img
                        class="campaign-ledger__mark"
                        src={defenseFaceImage(SHIELD)}
                        alt={side.makeup.shields === 1 ? 'shield' : 'shields'}
                    /></span
                ><TokenText
                    text={makeupWords(side.makeup)}
                    {seats}
                    warbandColor={gameSession.ledgerWarbandColor(side.seatId)}
                />
            </dd>
        {/if}
        {@render line('Plan', side.plan, side)}
        {@render line('Lost', side.lost, side)}
        {@render line('Gained', side.gained, side)}
    </dl>
{/snippet}

<div class="campaign-ledger" data-campaign-ledger>
    <p class="campaign-ledger__result"><TokenText text={ledger.result} {seats} /></p>
    {#each ledger.sides as side (side.role)}
        {@render sideRows(side)}
    {/each}
</div>

<style>
    .campaign-ledger {
        font-size: 14px;
        line-height: 20px;
    }
    .campaign-ledger__side {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
    }
    .campaign-ledger__lines {
        display: grid;
        grid-template-columns: 4.6em minmax(0, 1fr);
        column-gap: 6px;
        margin: 0;
    }
    .campaign-ledger__label {
        grid-column: 1;
        margin-top: 3px;
        font-size: 12px;
        line-height: 20px;
    }
    .campaign-ledger__value {
        grid-column: 2;
        margin: 3px 0 0;
        overflow-wrap: anywhere;
    }
    .campaign-ledger__dice {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 4px;
        margin-top: 2px;
    }
    .campaign-ledger__die {
        display: block;
        width: 18px;
        height: 18px;
        border-radius: 4px;
    }
    .campaign-ledger__mark {
        display: inline-block;
        width: 1.2em;
        height: 1.2em;
        margin-left: 0.2em;
        border-radius: 3px;
        vertical-align: -0.25em;
    }
    .token-count {
        white-space: nowrap;
    }
</style>
