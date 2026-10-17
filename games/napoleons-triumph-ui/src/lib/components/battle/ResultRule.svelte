<script lang="ts">
    import SwelledRule from '$lib/components/SwelledRule.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { signed } from '$lib/utils/signed.js'
    import ResultAccount from './ResultAccount.svelte'

    let {
        initialResult,
        finalResult,
        feint = false,
        inline = false
    }: {
        initialResult?: number
        finalResult?: number
        /** The attack was called off as a feint, so it has no result to give. */
        feint?: boolean
        inline?: boolean
    } = $props()

    const gameSession = getGameSession()
    const accounts = $derived(gameSession.resultAccounts)

    let explaining: 'initial' | 'final' | undefined = $state()
</script>

{#snippet result(name: string, value: number, which: 'initial' | 'final', explained: boolean)}
    {#if explained}
        <button
            type="button"
            class="nt-result-rule-result"
            aria-haspopup="dialog"
            onclick={() => (explaining = which)}>{name} <b>{signed(value)}</b></button
        >
    {:else}
        <span>{name} <b>{signed(value)}</b></span>
    {/if}
{/snippet}

{#snippet words()}
    <span class="nt-result-rule-words">
        {#if feint}
            <span>Feint</span>
        {/if}
        {#if initialResult !== undefined}
            {@render result(
                'Initial result',
                initialResult,
                'initial',
                accounts.initial !== undefined
            )}
        {/if}
        {#if initialResult !== undefined && finalResult !== undefined}
            <svg viewBox="0 0 10 10" aria-hidden="true"
                ><path d="M5 0 L10 5 L5 10 L0 5 Z"></path></svg
            >
        {/if}
        {#if finalResult !== undefined}
            {@render result('Final result', finalResult, 'final', accounts.counter !== undefined)}
        {/if}
    </span>
{/snippet}

{#if inline}
    {@render words()}
{:else}
    <div class="nt-result-rule">
        <SwelledRule>
            {@render words()}
        </SwelledRule>
    </div>
{/if}
{#if explaining === 'initial' && accounts.initial}
    <ResultAccount initial={accounts.initial} onclose={() => (explaining = undefined)} />
{:else if explaining === 'final' && accounts.counter}
    <ResultAccount counter={accounts.counter} onclose={() => (explaining = undefined)} />
{/if}

<style>
    .nt-result-rule {
        max-width: 60ch;
        padding: 2px 0;
    }

    .nt-result-rule-words {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-style: italic;
        line-height: 1.2;
        white-space: nowrap;
    }

    b {
        font-size: 17px;
        font-style: normal;
    }

    .nt-result-rule-result {
        font-style: inherit;
        cursor: pointer;
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 4px;
    }

    .nt-result-rule-result:hover {
        text-decoration-style: solid;
    }

    svg {
        width: 7px;
        height: 7px;
        fill: currentColor;
        opacity: 0.78;
    }

    @media (max-width: 639px) {
        .nt-result-rule-words {
            gap: 7px;
            font-size: 13px;
        }

        b {
            font-size: 15px;
        }
    }
</style>
