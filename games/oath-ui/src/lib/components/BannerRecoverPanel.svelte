<script lang="ts">
    import { FAVOR_BANK_ORDER } from '@tabletop/oath'
    import SuitPicker from '$lib/components/SuitPicker.svelte'
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
            <span class="text-oath-text-muted">Pay for the {bannerName(banner)}:</span>
            <input
                disabled={busy}
                type="number"
                min={amounts[0]}
                max={amounts[amounts.length - 1]}
                value={gameSession.bannerAmount}
                class="w-16 rounded bg-oath-surface-raised px-1 py-0.5 text-xs"
                oninput={(event) => gameSession.setBannerAmount(Number(event.currentTarget.value))}
            />
        </label>
        {#if gameSession.needsFavorStart}
            <div class="text-oath-text-muted">Return the favor on it starting at:</div>
            {@const start = gameSession.favorStart}
            <SuitPicker
                suits={FAVOR_BANK_ORDER}
                picked={start === undefined ? [] : [start]}
                onpick={(suit) => gameSession.setFavorStart(suit)}
                {busy}
            />
        {/if}
        {#if reason}
            <p class="text-[11px] text-oath-danger">{humanizeReason(reason)}</p>
        {/if}
        <button
            class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-0.5 self-start"
            disabled={busy || !!reason}
            onclick={() => gameSession.recoverBanner()}
        >
            Recover the {bannerName(banner)}
        </button>
    </div>
{/if}
