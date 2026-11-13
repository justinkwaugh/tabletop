<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { exchangeChoiceWords } from './presidencyExchangeWords.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const pending = $derived(session.stock.presidencyExchange)
    const choices = $derived(session.stock.presidencyExchangeChoices)
    const multiShare = $derived(session.presentation.multiShareCertificate)
    const capitalized = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)
</script>

{#if pending}
    {@const company = session.companyName(pending.companyId)}
    {@const outgoing = session.ownerName(pending.previous)}
    <section aria-label="Presidency exchange">
        <h3>{company}’s new president</h3>
        <p>
            {session.ownerName(pending.next)} takes {company}’s presidency.
            {session.stock.canChoosePresidencyExchange ? 'Choose' : `${outgoing} chooses`} what to take
            for the president’s certificate.
        </p>
        {#if session.stock.canChoosePresidencyExchange}
            <div class="choices" role="group" aria-label="Certificates to take">
                {#each choices as choice (choice.certificateIds.join(' '))}
                    <button
                        disabled={session.busy}
                        data-exchange-certificates={choice.certificateIds.join(' ')}
                        onclick={() =>
                            void session.stock.choosePresidencyExchange(choice.certificateIds)}
                        >{capitalized(exchangeChoiceWords(choice.certificates, multiShare))}</button
                    >
                {/each}
            </div>
            <p class="note">Each certificate counts toward your certificate limit.</p>
        {/if}
    </section>
{/if}

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 8px;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 650;
    }
    p {
        margin: 0;
        max-width: 42ch;
    }
    .note {
        font-size: 12px;
        color: var(--rail-muted, #817261);
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin: 6px 0 2px;
    }
    button {
        font: inherit;
        padding: 9px 14px;
        border: 1px solid var(--rail-border, #aebfb4);
        border-radius: 5px;
        background: var(--rail-surface, #edf3eb);
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
