<script lang="ts">
    import {
        BuyBackShares,
        buyBackCertificateIds,
        buyBackReason,
        canTakeCorporateLoan
    } from '@tabletop/1817'
    import { cashOwnedBy, companyMarketSpace, controllingOwner } from '@tabletop/18xx'
    import type { EighteenXXSession } from '@tabletop/18xx-ui'
    let { session }: { session: EighteenXXSession } = $props()
    const money = $derived(session.presentation.money)
    const gameState = $derived(session.gameState)
    const playerId = $derived(gameState.activePlayerIds[0])
    const companies = $derived(
        playerId &&
            (session.validActionTypes.includes('TakeLoan') ||
                session.validActionTypes.includes('BuyBackShares'))
            ? gameState.companies
                  .filter(
                      (company) =>
                          company.kind !== 'private' &&
                          company.started &&
                          controllingOwner(gameState, company.id)?.playerId === playerId
                  )
                  .map((company) => {
                      const nextShare = buyBackCertificateIds(gameState, company.id)[0]
                      return {
                          company,
                          canBorrow:
                              session.validActionTypes.includes('TakeLoan') &&
                              canTakeCorporateLoan(gameState, playerId, company.id),
                          nextShare:
                              nextShare &&
                              !buyBackReason(gameState, playerId, company.id, [nextShare])
                                  ? nextShare
                                  : undefined
                      }
                  })
                  .filter(({ canBorrow, nextShare }) => canBorrow || nextShare)
            : []
    )
    const busy = $derived(session.busy || session.updatingVisibleState || session.isViewingHistory)

    async function buyBack(companyId: string, certificateId: string) {
        await session.applyAction(
            session.createPlayerAction(BuyBackShares, {
                companyId,
                certificateIds: [certificateId]
            })
        )
    }
</script>

{#if companies.length}
    <section aria-label="Corporate actions">
        <h2>
            {gameState.stockRound.turn.corporateAction ? 'Acting for' : 'Or act for a company'}
        </h2>
        {#each companies as { company, canBorrow, nextShare } (company.id)}
            <div class="company">
                <strong>{company.name}</strong>
                <span
                    >Treasury {money(
                        Number(cashOwnedBy(gameState, { kind: 'company', companyId: company.id }))
                    )} · Loans {session.loans.loans(company.id)}/{session.loans.capacity(
                        company.id
                    )}</span
                >
                {#if canBorrow}<button
                        disabled={busy}
                        onclick={() => session.loans.take(company.id)}>Take a loan</button
                    >{/if}
                {#if nextShare}<button
                        disabled={busy}
                        onclick={() => buyBack(company.id, nextShare)}
                        >Buy back a share ({money(
                            companyMarketSpace(gameState.stockMarket, company.id).price
                        )})</button
                    >{/if}
            </div>
        {/each}
    </section>
{/if}

<style>
    section {
        padding: 6px 0;
        font-size: 12px;
        color: var(--rail-text, #514536);
        text-align: center;
    }
    h2 {
        margin: 0 0 4px;
        font-size: 13px;
    }
    .company {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 4px;
    }
    button {
        padding: 5px 10px;
        font: inherit;
        color: inherit;
        cursor: pointer;
        background: var(--rail-surface, #fffdf8);
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 7px;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
