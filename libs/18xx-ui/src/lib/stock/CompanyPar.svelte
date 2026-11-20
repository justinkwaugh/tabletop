<script lang="ts">
    import StartChoice from './StartChoice.svelte'
    import { getCompany } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { marketSpaceColor, marketZone } from './marketColors.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const pending = $derived(session.gameState.pendingPar)
</script>

{#if pending}
    {@const company = getCompany(session.gameState, pending.companyId)}
    <section class="centered-panel" aria-label="Set par">
        <p>
            {session.ownerName({ kind: 'player', playerId: pending.playerId })} sets {session.actionCompanyName(
                company.id
            )}’s par.
        </p>
        {#if session.stock.canPar}
            <div class="choices" aria-label="Par prices">
                {#each session.stock.parSpaceIds as spaceId (spaceId)}
                    {@const space = session.stockMarketChart.space(spaceId)}
                    {@const zone = marketZone(session.presentation.marketZones, space.color)}
                    <button
                        class="par-choice"
                        class:recessed={zone?.fill?.kind === 'recessed'}
                        disabled={session.busy}
                        style:background={marketSpaceColor(space.color, zone)}
                        data-par-price={space.price}
                        aria-pressed={session.stock.parOptionChoices.length
                            ? session.stock.selectedParPrice === spaceId
                            : undefined}
                        onclick={() => session.stock.parCompany(spaceId)}>{space.price}</button
                    >
                {/each}
            </div>
            {#each session.stock.parOptionChoices as choice (choice.id)}
                {@const spaceId = session.stock.selectedParPrice}
                <StartChoice
                    {choice}
                    spaces={spaceId
                        ? session.presentation.startChoiceSpaces?.(
                              session.gameState,
                              choice.id,
                              spaceId
                          )
                        : undefined}
                    stations={session.mapView.stations}
                    selected={session.stock.selectedParOptions[choice.id]}
                    disabled={session.busy}
                    onChoose={(optionId) => session.stock.chooseParOption(choice.id, optionId)}
                />
            {/each}
        {/if}
    </section>
{/if}

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    p {
        margin: 8px 0 0;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .par-choice {
        min-width: 48px;
        padding: 6px 10px;
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
        color: #2c2418;
        font-weight: 600;
    }
    .par-choice.recessed {
        color: var(--rail-text, #2c2418);
    }
    .par-choice:disabled {
        opacity: 0.4;
    }
    /* The price held while the title's choices are made: ringed, the others faded. */
    .par-choice[aria-pressed='true'] {
        box-shadow: 0 0 0 2px var(--rail-focus, #8c7050);
    }
    .choices:has(.par-choice[aria-pressed='true']) .par-choice[aria-pressed='false'] {
        opacity: 0.4;
    }
    .choices:has(.par-choice[aria-pressed='true'])
        .par-choice[aria-pressed='false']:hover:not(:disabled) {
        opacity: 0.8;
    }
</style>
