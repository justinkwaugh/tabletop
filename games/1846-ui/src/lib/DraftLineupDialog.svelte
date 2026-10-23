<script lang="ts">
    import { onMount } from 'svelte'
    import type { Corporation } from '@tabletop/1846'
    import { clickedBackdrop, CompanyToken } from '@tabletop/18xx-ui'
    import type { CompanyLineup } from './companyLineup.js'
    import { MapView1846 } from './mapView.js'
    let { lineup, onclose }: { lineup: CompanyLineup; onclose: () => void } = $props()
    let dialog: HTMLDialogElement
    const titleId = $props.id()
    onMount(() => {
        dialog.showModal()
        return () => dialog.close()
    })
    function closeOutside(event: MouseEvent) {
        if (clickedBackdrop(dialog, event)) dialog.close()
    }
</script>

<!-- The catalogue's tokens, not the session's: the board draws removed homes as solid discs. -->
{#snippet tokens(companies: readonly Corporation[])}
    {#each companies as company (company.id)}<span class="token" title={company.name}
            ><CompanyToken appearance={MapView1846.stations[company.id]} size={24} /></span
        >{/each}
{/snippet}

<dialog bind:this={dialog} aria-labelledby={titleId} {onclose} onclick={closeOutside}>
    <header>
        <h2 id={titleId}>Companies in this {lineup.playerCount}-player game</h2>
        <button class="close" aria-label="Close" onclick={() => dialog.close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
                ><path
                    d="m4 4 8 8m0-8-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                ></path></svg
            >
        </button>
    </header>
    <dl>
        <dt>In play</dt>
        <dd>{@render tokens(lineup.corporations)}</dd>
        {#if lineup.passCards}
            <dt>Deck</dt>
            <dd>
                {lineup.privateNames.join(' · ')} ·
                <span class="pass">{lineup.passCards}&nbsp;Pass</span>
            </dd>
        {:else}
            <dt>Privates</dt>
            <dd>{lineup.privateNames.join(' · ')}</dd>
        {/if}
        {#if lineup.removedCorporations.length || lineup.removedPrivateNames.length}
            <dt>Removed</dt>
            <dd class="removed">
                {@render tokens(lineup.removedCorporations)}
                {lineup.removedPrivateNames.join(' · ')}
            </dd>
        {/if}
    </dl>
</dialog>

<style>
    dialog {
        margin: auto;
        box-sizing: border-box;
        width: min(460px, calc(100vw - 32px));
        max-height: calc(100dvh - 48px);
        padding: 0;
        border: 1px solid var(--rail-border, #c3b39e);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #463e35);
        box-shadow: 0 20px 70px var(--rail-shadow, #16120d55);
    }
    dialog::backdrop {
        background: var(--rail-backdrop, #17141099);
    }
    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rail-border, #ded4c7);
    }
    h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 650;
    }
    header .close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--rail-text, #766653);
        cursor: pointer;
    }
    header .close:hover {
        background: var(--rail-surface-raised, #e9e1d5);
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: 2px;
    }
    dl {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: baseline;
        gap: 10px 12px;
        margin: 0;
        padding: 14px 16px 16px;
        font-size: 13px;
        line-height: 1.6;
    }
    dt {
        font-size: 10px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--rail-muted, #786550);
        text-align: right;
    }
    dd {
        margin: 0;
    }
    .token {
        display: inline-block;
        margin-right: 3px;
        vertical-align: middle;
    }
    .pass {
        font-style: italic;
    }
    .removed {
        color: var(--rail-muted, #786550);
    }
    .removed > .token {
        opacity: 0.45;
    }
</style>
