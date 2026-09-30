<script lang="ts">
    import { FAVOR_BANK_ORDER } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bannerName, humanizeReason } from '$lib/model/names.js'

    // R-5.4.2 the bid; R-5.4.4 the bank the People's Favor's old favor starts returning to.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let banner = $derived(gameSession.stagedBanner)
    let amounts = $derived(gameSession.bannerAmounts)
    let reason = $derived(gameSession.bannerRecoverReason)
</script>

{#if banner}
    <div class="flex flex-col gap-1.5 text-xs">
        <label class="flex items-center gap-2">
            <span class="text-stone-400">Pay for the {bannerName(banner)}:</span>
            <input
                disabled={busy}
                type="number"
                min={amounts[0]}
                max={amounts[amounts.length - 1]}
                value={gameSession.bannerAmount}
                class="w-16 rounded bg-stone-800 px-1 py-0.5 text-xs"
                oninput={(event) => gameSession.setBannerAmount(Number(event.currentTarget.value))}
            />
        </label>
        {#if gameSession.needsFavorStart}
            <div class="text-stone-400">Return the favor on it starting at:</div>
            <div class="flex flex-wrap gap-1">
                {#each FAVOR_BANK_ORDER as suit (suit)}
                    <button
                        class="rounded border px-2 py-0.5 capitalize {gameSession.favorStart ===
                        suit
                            ? 'border-amber-300 bg-amber-900/60'
                            : 'border-stone-600 bg-stone-800/60 hover:border-amber-300'}"
                        disabled={busy}
                        onclick={() => gameSession.setFavorStart(suit)}
                    >
                        {suit}
                    </button>
                {/each}
            </div>
        {/if}
        {#if reason}
            <p class="text-[11px] text-rose-300">{humanizeReason(reason)}</p>
        {/if}
        <button
            class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-0.5 self-start"
            disabled={busy || !!reason}
            onclick={() => gameSession.recoverBanner()}
        >
            Recover the {bannerName(banner)}
        </button>
    </div>
{/if}
