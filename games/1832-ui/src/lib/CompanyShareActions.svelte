<script lang="ts">
    import { EighteenThirtyTwoMarket, type RedemptionChoice } from '@tabletop/1832'
    import { CompanyActionCard, CompanyActionPanel } from '@tabletop/18xx-ui'
    import { companyShareFacts, redemptionHolderName } from './companyShareFacts.js'
    import type { EighteenThirtyTwoSession } from './session.svelte.js'
    let { session }: { session: EighteenThirtyTwoSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)
    // Holders in seat order, as in the players panel.
    const bySeat = (choices: readonly RedemptionChoice[]) =>
        choices.toSorted((left, right) => seat(left) - seat(right))
    const seat = ({ holder }: RedemptionChoice) =>
        holder.kind === 'player'
            ? gameState.players.findIndex((player) => player.playerId === holder.playerId)
            : -1
</script>

<CompanyActionPanel label="Company share actions" heading="Act for a company">
    {#each session.companyShareOptions as { companyId, redemptions, reissue } (companyId)}
        {@const name = session.companyName(companyId)}
        <CompanyActionCard
            {session}
            {companyId}
            value={money(
                EighteenThirtyTwoMarket.companySpace(gameState.stockMarket, companyId).price
            )}
            facts={companyShareFacts(gameState, companyId, money)}
            actions={reissue
                ? [
                      {
                          label: `Reissue ${reissue.certificateIds.length} ${reissue.certificateIds.length === 1 ? 'share' : 'shares'}`,
                          detail: `at ${money(reissue.parPrice)}`,
                          ariaLabel: `Reissue ${name}'s redeemed shares at ${money(reissue.parPrice)}`,
                          disabled: busy,
                          onclick: () => session.reissueShares(companyId)
                      }
                  ]
                : []}
        >
            {#if redemptions.length}
                <!-- Every holder is paid the share price, so it is named once. -->
                <div class="redemption" role="group" aria-label={`Redeem a ${name} share`}>
                    <p>Redeem a share for <strong>{money(redemptions[0].price)}</strong> from</p>
                    <div class="holders">
                        {#each bySeat(redemptions) as choice (choice.certificateId)}
                            {@const playerId =
                                choice.holder.kind === 'player'
                                    ? choice.holder.playerId
                                    : undefined}
                            {@const from = redemptionHolderName(choice.holder, (id) =>
                                session.getPlayerName(id)
                            )}
                            <button
                                class:player={playerId}
                                style:--player-color={playerId
                                    ? session.colors.getPlayerBgColorValue(playerId)
                                    : undefined}
                                disabled={busy}
                                aria-label={`Redeem a ${name} share from ${from} for ${money(choice.price)}`}
                                onclick={() => session.redeemShare(choice)}
                                >{#if playerId}<span class="player-color"></span>{/if}{playerId
                                    ? from
                                    : 'Market'}</button
                            >
                        {/each}
                    </div>
                </div>
            {/if}
        </CompanyActionCard>
    {/each}
</CompanyActionPanel>

<style>
    /* The holders widen the card up to the panel's width, then wrap. */
    .redemption {
        width: max-content;
        max-width: calc(100cqw - 2px);
        min-width: 100%;
        box-sizing: border-box;
        padding: 6px 8px 8px;
        border-top: 1px solid var(--rail-border, #d8cbbc);
        background: var(--rail-surface-inset, #1b232d);
        text-align: center;
    }
    p {
        margin: 0 0 6px;
        color: var(--rail-muted, #887969);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    strong {
        color: var(--rail-text, #514536);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0;
    }
    .holders {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border: 0;
        border-radius: 4px;
        background: var(--rail-solid, #40576b);
        color: var(--rail-text, #e3e9ef);
        font: inherit;
        font-size: 13px;
        cursor: pointer;
    }
    button.player {
        background: color-mix(in srgb, var(--player-color) 25%, var(--rail-surface, #222c37));
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-selected, #3a4c5e);
    }
    button.player:hover:not(:disabled) {
        background: color-mix(in srgb, var(--player-color) 45%, var(--rail-surface, #222c37));
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .player-color {
        width: 10px;
        height: 10px;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--player-color);
    }
</style>
