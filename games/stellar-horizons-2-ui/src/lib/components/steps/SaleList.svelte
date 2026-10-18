<script lang="ts">
    import { SALE_INFLUENCE, SALE_PAYMENT, SOL_SYSTEM_ID } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'
    import GoodChit from '../GoodChit.svelte'

    const gameSession = getGameSession()
    const draft = $derived(gameSession.saleDraft)
</script>

{#if gameSession.saleOptions.length > 0}
    <div class="sales" role="group" aria-label="Goods to sell">
        <div class="heading">Sell goods where there is demand</div>
        {#each gameSession.saleOptions as option (`${option.systemId}:${option.good}`)}
            {@const available = option.sources.reduce((total, source) => total + source.count, 0)}
            {@const chosen = draft?.systemId === option.systemId && draft.good === option.good}
            {@const offEarth = option.systemId !== SOL_SYSTEM_ID}
            <div class="sale" class:chosen>
                <button
                    type="button"
                    class="option"
                    aria-pressed={chosen}
                    onclick={() => gameSession.chooseSale(option)}
                >
                    <GoodChit good={option.good} count={available} size={28} />
                    <span class="what"
                        >{goodName(option.good)} at {systemName(option.systemId)}</span
                    >
                    <span class="price"
                        >${option.price}B each{offEarth ? `, +${SALE_INFLUENCE} IP` : ''}</span
                    >
                </button>
                {#if chosen && draft}
                    <div class="terms">
                        <span class="count">
                            <button
                                type="button"
                                aria-label="Sell one fewer"
                                disabled={draft.count <= 1}
                                onclick={() => gameSession.adjustSaleCount(-1)}>−</button
                            >
                            <b>{draft.count}</b>
                            <button
                                type="button"
                                aria-label="Sell one more"
                                disabled={draft.count >= available}
                                onclick={() => gameSession.adjustSaleCount(1)}>+</button
                            >
                        </span>
                        {#if option.payeeIds.length > 1}
                            <span class="payees" role="group" aria-label="Whom to pay">
                                {#each option.payeeIds as payeeId (payeeId)}
                                    <button
                                        type="button"
                                        aria-pressed={draft.payeeId === payeeId}
                                        onclick={() => gameSession.chooseSalePayee(payeeId)}
                                        >Pay {gameSession.getPlayerName(payeeId)}</button
                                    >
                                {/each}
                            </span>
                        {:else if draft.payeeId}
                            <span class="note"
                                >Pays {gameSession.getPlayerName(draft.payeeId)} ${draft.count *
                                    SALE_PAYMENT}B</span
                            >
                        {/if}
                        <button
                            type="button"
                            class="primary"
                            disabled={option.payeeIds.length > 0 && !draft.payeeId}
                            onclick={() => gameSession.commitSale()}
                            >Sell {draft.count} for ${draft.count * option.price}B</button
                        >
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .sales {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 8px;
        border-top: 1px solid #22314d;
    }

    .heading {
        font-size: 13px;
        font-weight: 700;
        color: #b7c7de;
    }

    .sale {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
    }

    .option {
        display: flex;
        align-items: center;
        gap: 8px;
        text-align: left;
    }

    .option[aria-pressed='true'] {
        border-color: #7fd3ff;
    }

    .what {
        font-weight: 700;
        color: #e8f1ff;
    }

    .price,
    .note {
        font-size: 12.5px;
        color: #8fa4c2;
    }

    .terms {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 10px;
    }

    .count {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .count button {
        width: 28px;
        padding: 0;
    }

    .payees {
        display: flex;
        gap: 6px;
    }

    .payees button[aria-pressed='true'] {
        border-color: #7fd3ff;
        color: #e8f1ff;
    }
</style>
