<script lang="ts">
    import { CompanyToken, type EighteenXXSessionView } from '@tabletop/18xx-ui'
    import { startOrder, type StartStanding } from './startOrder.js'
    let {
        session,
        reveal
    }: { session: EighteenXXSessionView; reveal: (locationId: string) => void } = $props()
    const entries = $derived(startOrder(session.gameState))
    const TokenSize = 34

    /** What shows under a corporation's token, and what its description says of it. */
    function standingWords(standing: StartStanding): { label: string; description: string } {
        switch (standing.kind) {
            case 'started':
                return { label: 'Started', description: 'started' }
            case 'next':
                return { label: 'Next', description: 'the next to start' }
            case 'closed':
                return {
                    label: `From SR ${standing.stockRound}`,
                    description: `closed, may start again from stock round ${standing.stockRound}`
                }
            case 'no-home':
                return {
                    label: 'No home',
                    description: 'set aside until one of its cities has room'
                }
            case 'returning':
                return {
                    label: `From SR ${standing.stockRound}`,
                    description: `set aside, may start from stock round ${standing.stockRound} now one of its cities has room`
                }
            case 'waiting':
                return { label: '', description: 'waiting its turn' }
        }
    }
</script>

<section class="start-order" aria-label="Start order">
    <h3>Start order</h3>
    <ol>
        {#each entries as { companyId, name, homeLocationIds, standing }, index (companyId)}
            {@const homes = homeLocationIds.map((id) => session.placeName(id)).join(', ')}
            {@const words = standingWords(standing)}
            {@const description = `${index + 1}. ${name}, ${words.description}; home ${homes}`}
            <li class={standing.kind}>
                <span class="place">{index + 1}</span>
                <button
                    class="token"
                    title={description}
                    aria-label={`Show ${description}`}
                    onclick={() => reveal(homeLocationIds[0])}
                    ><CompanyToken
                        appearance={session.mapView.stations[companyId]}
                        size={TokenSize}
                    /></button
                >
                <span class="standing">{words.label}</span>
            </li>
        {/each}
    </ol>
</section>

<style>
    .start-order {
        padding: 8px 10px 9px;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 4px;
        background: var(--rail-surface, #faf7f2);
        color: var(--rail-text, #463e35);
    }
    h3 {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--rail-muted, #817261);
    }
    ol {
        display: flex;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    li {
        display: grid;
        justify-items: center;
        gap: 3px;
        width: 56px;
    }
    .place {
        font-size: 14px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
    .token {
        width: 40px;
        height: 40px;
        padding: 3px;
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
    .next .standing {
        padding: 0 7px;
        border-radius: 7px;
        background: #f2c94c;
        color: #2a2416;
        font-weight: 750;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }
    .started .token,
    .started .place {
        opacity: 0.4;
    }
    .standing {
        min-height: 14px;
        font-size: 11px;
        font-weight: 550;
        white-space: nowrap;
        color: var(--rail-muted, #817261);
    }
</style>
