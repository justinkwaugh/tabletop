<script lang="ts">
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { charterRows } from './charters.js'
    import type { Session1862 } from './session.svelte.js'
    let { session, reveal }: { session: Session1862; reveal: (locationId: string) => void } =
        $props()
    const rows = $derived(charterRows(session.gameState))
    const TokenSize = 30
</script>

<section class="charters" aria-label="Charters">
    <h3>Charters</h3>
    {#each rows as row (row.label)}
        <div class="row">
            <span class="label"
                >{row.label}{#if row.note}<small>{row.note}</small>{/if}</span
            >
            <span class="tokens">
                {#each row.charters as { companyId, name, home, started } (companyId)}
                    {@const description = `${name}, home ${session.placeName(home)}${row.out ? ', out of play' : started ? ', started' : ''}`}
                    <button
                        class="token"
                        class:taken={started}
                        class:out={row.out}
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
        </div>
    {/each}
</section>

<style>
    .charters {
        color: var(--rail-text, #463e35);
        min-width: 210px;
    }
    h3 {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--rail-muted, #817261);
    }
    .row {
        display: grid;
        grid-template-columns: 76px auto;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        border-top: 1px solid var(--rail-border, #d6cbbc);
    }
    .label {
        font-size: 12px;
        font-weight: 650;
    }
    .label small {
        display: block;
        font-size: 10px;
        font-weight: 400;
        color: var(--rail-muted, #817261);
    }
    .tokens {
        display: grid;
        grid-template-columns: repeat(4, 30px);
        gap: 5px;
    }
    .token {
        position: relative;
        width: 30px;
        height: 30px;
        padding: 0;
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
        outline-offset: 2px;
    }
    .taken,
    .out {
        opacity: 0.35;
    }
    .out::after {
        content: '';
        position: absolute;
        left: -3px;
        right: -3px;
        top: 13.5px;
        height: 3px;
        border-radius: 2px;
        background: var(--rail-text, #463e35);
        transform: rotate(-35deg);
    }
</style>
