<script lang="ts">
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session, disabled }: { session: EighteenXXSession; disabled: boolean } = $props()
    const money = $derived(session.presentation.money)
    let prices = $derived.by((): Record<string, number> => {
        void session.gameState
        return {}
    })
    const price = (id: string, minimum: number) => prices[id] ?? minimum
</script>

<div class="private-offers" aria-label="Buy a private from a player">
    {#each session.stock.privateChoices as choice (choice.privateCompanyId)}
        {@const amount = price(choice.privateCompanyId, choice.range.minimum)}
        {@const reason = session.stock.privateOfferReason(choice.privateCompanyId, amount)}
        {@const name = getCompany(session.gameState, choice.privateCompanyId).name}
        <form
            class="private-offer"
            data-private-offer={choice.privateCompanyId}
            onsubmit={(event) => {
                event.preventDefault()
                if (!reason)
                    void session.stock.offerPrivatePurchase(choice.privateCompanyId, amount)
            }}
        >
            <span class="private-name">{name}</span>
            <span class="private-owner">{session.getPlayerName(choice.sellerPlayerId)}</span>
            <input
                type="number"
                aria-label={`Offer for ${name}`}
                min={choice.range.minimum}
                max={choice.range.maximum}
                step="1"
                value={amount}
                {disabled}
                oninput={(event) => {
                    prices = {
                        ...prices,
                        [choice.privateCompanyId]: event.currentTarget.valueAsNumber
                    }
                }}
            />
            <button type="submit" disabled={disabled || !!reason} title={reason}
                >Offer {Number.isFinite(amount) ? money(amount) : ''}</button
            >
        </form>
    {/each}
</div>

<style>
    .private-offers {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: fit-content;
        max-width: 100%;
        margin-inline: auto;
    }
    .private-offer {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto 80px auto;
        align-items: center;
        gap: 10px;
    }
    .private-owner {
        color: var(--rail-muted, #95816a);
    }
    input {
        font: inherit;
        color: inherit;
        width: 100%;
        box-sizing: border-box;
        padding: 5px 6px;
        background: var(--rail-surface-inset, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
    }
    button {
        font: inherit;
        font-weight: 400;
        color: inherit;
        background: var(--rail-surface-raised, #efe7db);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
