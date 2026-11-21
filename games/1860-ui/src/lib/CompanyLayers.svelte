<script lang="ts">
    import { CompanyToken, type EighteenXXSessionView } from '@tabletop/18xx-ui'
    import { companyLayers, type LayerEntry } from './layers.js'
    let {
        session,
        reveal
    }: { session: EighteenXXSessionView; reveal: (locationId: string) => void } = $props()
    const layers = $derived(companyLayers(session.gameState))
    const next = $derived(layers.find((entry) => entry.standing === 'next'))
    const before = $derived(next && layers.find((entry) => entry.layer === next.layer - 1))
    const TokenSize = 30
    const money = (amount: number) => session.presentation.money(amount)
    const initials = (entry: LayerEntry) =>
        entry.companies.map(({ companyId }) => session.companyInitials(companyId)).join(' or ')
    const standingLabel = { open: 'Open', next: 'Next' } as const
</script>

<section class="layers" aria-label="Company layers">
    <h3>Layers</h3>
    <ol>
        {#each layers as entry (entry.layer)}
            <li class={entry.standing}>
                <span class="layer">{entry.layer}</span>
                <span class="tokens">
                    {#each entry.companies as { companyId, home, started } (companyId)}
                        {@const description = `${session.companyName(companyId)}, home ${session.placeName(home)}${started ? ', started' : ''}`}
                        <button
                            class="token"
                            title={description}
                            aria-label={`Show ${description}`}
                            onclick={() => reveal(home)}
                            ><CompanyToken
                                appearance={session.mapView.stations[companyId]}
                                size={TokenSize}
                            /></button
                        >
                    {/each}
                </span>
                <span class="par" title="Par prices"
                    >{money(entry.parRange.minimum)}–{money(entry.parRange.maximum)}</span
                >
                <span class="standing"
                    >{#if entry.standing !== 'later'}<span class="chip"
                            >{standingLabel[entry.standing]}</span
                        >{/if}</span
                >
            </li>
        {/each}
    </ol>
    {#if next && before}
        <p class="opens">
            Layer {next.layer} opens once {initials(before)} operates or sells out of the IPO.
        </p>
    {/if}
</section>

<style>
    .layers {
        width: 252px;
        padding: 8px 10px 9px;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 4px;
        background: var(--rail-surface, #faf7f2);
        color: var(--rail-text, #463e35);
    }
    h3 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--rail-muted, #817261);
    }
    ol {
        display: grid;
        grid-template-columns: auto auto 1fr auto;
        align-items: center;
        gap: 2px 8px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li {
        display: contents;
    }
    .layer {
        font-size: 15px;
        font-weight: 750;
        font-variant-numeric: tabular-nums;
        text-align: center;
    }
    .tokens {
        display: flex;
        gap: 2px;
    }
    .token {
        width: 34px;
        height: 34px;
        padding: 2px;
        border: 0;
        border-radius: 50%;
        background: none;
        cursor: pointer;
    }
    .token :global(svg) {
        display: block;
    }
    .token:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 1px;
    }
    .par {
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        color: var(--rail-muted, #817261);
    }
    .standing {
        min-width: 40px;
        font-size: 11px;
        font-weight: 650;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        white-space: nowrap;
    }
    .chip {
        display: inline-block;
        padding: 0 6px;
        border-radius: 7px;
    }
    .next .chip {
        background: #f2c94c;
        color: #2a2416;
    }
    .later .layer,
    .later .tokens,
    .later .par {
        opacity: 0.45;
    }
    .opens {
        margin: 6px 0 0;
        font-size: 11.5px;
        line-height: 1.35;
        color: var(--rail-muted, #817261);
    }
</style>
