<script lang="ts">
    import { getCompany, type PrivatePowerRequestDropReason } from '@tabletop/18xx'
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    import PrivateExchangeButton from './PrivateExchangeButton.svelte'
    import PrivateTrackPowerButton from './PrivateTrackPowerButton.svelte'

    let { session }: { session: EighteenXXSession } = $props()
    const gameState = $derived(session.gameState)
    const isActive = (playerId: string) => gameState.activePlayerIds.includes(playerId)
    const exchanges = $derived(
        session.privates.allExchangeOptions.filter(
            (option) => gameState.machineState !== 'StockRound' || !isActive(option.playerId)
        )
    )
    const trackPowers = $derived(
        session.privateActions.trackPowers.filter((power) => !isActive(power.playerId))
    )
    const requestPlayers = $derived(session.privates.requestPlayers)
    const selectedPower = $derived(session.privateActions.trackPowerSelection?.value)
    const prompts = $derived(session.presentation.privateTilePrompts ?? {})
    const actors = $derived(
        new Set([
            ...exchanges.map((option) => option.playerId),
            ...trackPowers.map((power) => power.playerId),
            ...requestPlayers
        ])
    )
    const dropText: Record<PrivatePowerRequestDropReason, string> = {
        'no-legal-use': 'no legal use remained',
        'private-closed': 'the private closed',
        'owner-changed': 'the private changed owner'
    }
    function owner(playerId: string) {
        return actors.size > 1 || playerId !== session.myPlayer?.id
            ? `${session.getPlayerName(playerId)} · `
            : ''
    }
</script>

{#if actors.size}
    <div class="private-powers" role="group" aria-label="Private powers">
        {#each exchanges as option (`${option.playerId}:${option.privateCompanyId}:${option.certificateId}`)}
            <span class="power">
                <span class="name"
                    >{owner(option.playerId)}{getCompany(gameState, option.privateCompanyId)
                        .name}</span
                >
                <PrivateExchangeButton {session} {option} />
            </span>
        {/each}
        {#each trackPowers as power (`${power.playerId}:${power.privateCompanyId}`)}
            <span class="power">
                <span class="name"
                    >{owner(power.playerId)}{getCompany(gameState, power.privateCompanyId)
                        .name}</span
                >
                <PrivateTrackPowerButton
                    {session}
                    {power}
                    label={prompts[power.privateCompanyId] ?? 'Lay a tile'}
                />
            </span>
        {/each}
        {#if selectedPower && !isActive(selectedPower.playerId)}
            <span class="power prompt" role="status"
                >Choose a location on the map
                <button class="text" onclick={() => session.privateActions.clear()}>Cancel</button
                ></span
            >
        {/if}
        {#each requestPlayers as playerId (playerId)}
            {@const requested = session.privates.hasRequest(playerId)}
            {@const dropped = requested ? undefined : session.privates.lastRequestDrop(playerId)}
            <span class="power">
                <span class="name"
                    >{owner(playerId)}{session.privates
                        .requestablePrivateNames(playerId)
                        .join(', ')}</span
                >
                <button
                    class="request"
                    aria-pressed={requested}
                    aria-label={`Pause before the next company for ${session.getPlayerName(playerId)}`}
                    disabled={session.busy}
                    onclick={() => void session.privates.setRequest(playerId, !requested)}
                    >{requested
                        ? 'Pausing before next company'
                        : 'Pause before next company'}</button
                >
                {#if dropped}<span class="dropped" role="status"
                        >Pause dropped: {dropText[dropped]}</span
                    >{/if}
            </span>
        {/each}
    </div>
{/if}

<style>
    .private-powers {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 4px 18px;
        padding: 5px 12px;
        border-bottom: 1px solid var(--rail-border, #b8a995);
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #514538);
        font-size: 12px;
    }
    .power {
        display: inline-flex;
        align-items: center;
        gap: 7px;
    }
    .name {
        font-weight: 500;
    }
    .prompt {
        color: var(--rail-muted, #887664);
    }
    .dropped {
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    button {
        font: inherit;
        cursor: pointer;
    }
    .text {
        padding: 0 4px;
        border: 0;
        background: transparent;
        color: inherit;
        text-decoration: underline;
    }
    .request {
        padding: 1px 8px;
        border: 1px solid var(--rail-border, #a99983);
        border-radius: 10px;
        background: var(--rail-surface, #fffdf8);
        color: var(--rail-text, #514538);
        font-size: 11px;
        font-weight: 600;
    }
    .request[aria-pressed='true'] {
        background: var(--rail-solid, #695540);
        border-color: var(--rail-focus, #695540);
        color: #fffaf4;
    }
    .request:disabled {
        opacity: 0.45;
        cursor: default;
    }
    button:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
</style>
