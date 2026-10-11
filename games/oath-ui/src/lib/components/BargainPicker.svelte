<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { PowerChoiceKind, type LegalChoice } from '@tabletop/oath'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import TokenText from '$lib/components/TokenText.svelte'
    import { favorToken, secretToken } from '$lib/images/tileImages.js'
    import {
        bargainRows,
        withBargainCount,
        withBargainPlayer,
        type BargainPick
    } from '$lib/model/bargainPicks.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // Witch's Bargain from revision 7 (its Q&A: one use may affect several players at your site).
    // "With:" offers each player there as their chip; a tap picks them and opens their two rows of
    // your own pieces, a second tap drops them. Each row is held to what the engine's bounds leave:
    // the secret the cost places is never given, and Vow of Silence draws no secrets row.
    let {
        legal,
        picks,
        onchange
    }: {
        legal: LegalChoice
        picks: BargainPick[]
        onchange: (picks: BargainPick[]) => void
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let me = $derived(gameSession.myPlayer?.id)
    let players = $derived(
        legal.options.flatMap((option) =>
            option.kind === PowerChoiceKind.Bargain ? [option.playerId] : []
        )
    )
    let picked = $derived(picks.filter((pick) => players.includes(pick.playerId)))

    function nameOf(playerId: string): string {
        return gameSession.getPlayerName(playerId)
    }
</script>

<div class="bargain-picker text-xs" data-bargain-picker>
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-oath-text-muted">With:</span>
        <span class="inline-grid auto-cols-fr grid-flow-col gap-1.5">
            {#each players as playerId (playerId)}
                {@const on = picked.some((pick) => pick.playerId === playerId)}
                <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-md border p-[3px] text-sm
                           disabled:opacity-40 max-sm:min-h-11 max-sm:px-1.5 {on
                        ? 'border-oath-accent ring-1 ring-oath-accent'
                        : 'border-oath-frame bg-oath-surface'}"
                    aria-pressed={on}
                    aria-label={nameOf(playerId)}
                    disabled={busy}
                    onclick={() => onchange(withBargainPlayer(picks, playerId))}
                >
                    <PlayerName {playerId} />
                </button>
            {/each}
        </span>
    </div>
    {#if me}
        {#each picked as pick (pick.playerId)}
            {@const rows = bargainRows(gameSession.gameState, me, picked, pick.playerId)}
            {@const name = nameOf(pick.playerId)}
            <div class="mt-1.5 flex flex-col gap-1" data-bargain-with={pick.playerId}>
                {#if picked.length > 1}
                    <span class="text-sm"><PlayerName playerId={pick.playerId} />:</span>
                {/if}
                {#if rows.secrets}
                    <div class="bargain-row" data-bargain-row="secrets">
                        <span class="text-oath-text-muted"
                            ><TokenText text="Give secret for favor favor:" /></span
                        >
                        <TokenRow
                            image={secretToken()}
                            {...rows.secrets}
                            label={(n) =>
                                `give ${name} ${n} ${n === 1 ? 'secret' : 'secrets'} for ${2 * n} favor`}
                            ontap={(n) =>
                                onchange(withBargainCount(picks, pick.playerId, 'secretsGiven', n))}
                            {busy}
                        />
                    </div>
                {/if}
                <div class="bargain-row" data-bargain-row="pairs">
                    <span class="text-oath-text-muted"
                        ><TokenText text="Give favor favor for secret:" /></span
                    >
                    <TokenRow
                        image={favorToken()}
                        {...rows.pairs}
                        per={2}
                        label={(n) =>
                            `give ${name} ${2 * n} favor for ${n} ${n === 1 ? 'secret' : 'secrets'}`}
                        ontap={(n) =>
                            onchange(withBargainCount(picks, pick.playerId, 'pairsGiven', n))}
                        {busy}
                    />
                </div>
            </div>
        {/each}
    {/if}
</div>

<style>
    .bargain-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
    }
    @media (max-width: 639px) {
        .bargain-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
