<script lang="ts">
    // Terms for a new pact, or a counter to one: partners, the ships each pledges and how the
    // reward is split. A Player guarantees only their own ships; the others' are offered as
    // everyone sees them, and their owners check them when they accept.
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        shipDefinition,
        termsProblem,
        usesAnomalyRewards,
        type Pact,
        type PactShare,
        type PactTerms
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SHARE_ITEMS,
        candidatePartners,
        candidateShips,
        evenShares,
        targetReward,
        type PactSubject
    } from '$lib/utils/pacts.js'

    let {
        subject,
        existing,
        onclose
    }: { subject: PactSubject; existing?: Pact; onclose: () => void } = $props()

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const others = $derived(candidatePartners(gameState, me, subject))

    const ITEM_LABELS: Record<(typeof SHARE_ITEMS)[number], string> = {
        influence: 'IP',
        cash: '$B',
        markers: 'Markers',
        settlements: 'Settlements'
    }

    // The editor's draft starts from the terms it counters, once; later changes to them do not
    // reset what the Player is drafting.
    function startingDraft() {
        const terms = existing?.terms
        return {
            partnerIds: terms ? [...terms.partnerIds] : [me],
            pledges: terms
                ? Object.fromEntries(
                      Object.entries(terms.pledges).map(([playerId, shipIds]) => [
                          playerId,
                          [...shipIds]
                      ])
                  )
                : { [me]: [] },
            shares: terms
                ? Object.fromEntries(
                      Object.entries(terms.shares).map(([playerId, share]) => [
                          playerId,
                          { ...share }
                      ])
                  )
                : undefined,
            keeperId: terms?.keeperId
        }
    }
    const draft = startingDraft()
    let partnerIds: string[] = $state(draft.partnerIds)
    let pledges: Record<string, string[]> = $state(draft.pledges)
    let shares: Record<string, PactShare> | undefined = $state(draft.shares)
    let keeperId: string | undefined = $state(draft.keeperId)

    const target = $derived(targetReward(gameState, subject, partnerIds))
    const reward = $derived(target?.reward)
    const items = $derived(reward ? SHARE_ITEMS.filter((item) => reward[item] > 0) : [])
    const currentShares = $derived(shares ?? (reward ? evenShares(reward, partnerIds, me) : {}))
    const keeps = $derived(!usesAnomalyRewards(gameState) && subject.targetKind === 'Anomaly')
    const terms: PactTerms = $derived({
        targetKind: subject.targetKind,
        targetId: subject.targetId,
        challenge: subject.challenge,
        partnerIds,
        pledges: Object.fromEntries(
            partnerIds.map((playerId) => [playerId, pledges[playerId] ?? []])
        ),
        shares: Object.fromEntries(
            partnerIds.map((playerId) => [playerId, currentShares[playerId]])
        ),
        ...(keeps ? { keeperId: keeperId ?? me } : {})
    })
    const strength = $derived(
        partnerIds.reduce(
            (total, playerId) =>
                total +
                candidateShips(gameState, playerId, subject)
                    .filter((entry) => (pledges[playerId] ?? []).includes(entry.ship.shipId))
                    .reduce((sum, entry) => sum + entry.strength, 0),
            0
        )
    )
    const problem = $derived(termsProblem(gameState, me, terms, existing?.id))

    function togglePartner(playerId: string) {
        partnerIds = partnerIds.includes(playerId)
            ? partnerIds.filter((candidate) => candidate !== playerId)
            : [...partnerIds, playerId]
        shares = undefined
    }

    function toggleShip(playerId: string, shipId: string) {
        const current = pledges[playerId] ?? []
        pledges = {
            ...pledges,
            [playerId]: current.includes(shipId)
                ? current.filter((candidate) => candidate !== shipId)
                : [...current, shipId]
        }
    }

    function adjustShare(playerId: string, item: (typeof SHARE_ITEMS)[number], change: number) {
        const next = Object.fromEntries(
            Object.entries(currentShares).map(([partnerId, share]) => [partnerId, { ...share }])
        )
        next[playerId][item] = Math.max(0, next[playerId][item] + change)
        shares = next
    }

    async function propose() {
        if (problem) return
        await gameSession.proposePact(terms, existing?.id)
        onclose()
    }
</script>

<div class="editor">
    <div class="partners">
        <span class="label">Partners</span>
        <span class="chip mine"><PlayerName playerId={me} /></span>
        {#each others as playerId (playerId)}
            <button
                type="button"
                class="chip"
                class:on={partnerIds.includes(playerId)}
                aria-pressed={partnerIds.includes(playerId)}
                onclick={() => togglePartner(playerId)}><PlayerName {playerId} /></button
            >
        {/each}
    </div>

    {#each partnerIds as playerId (playerId)}
        <div class="pledge">
            <span class="who"
                >{playerId === me ? 'Your ships' : ''}{#if playerId !== me}<PlayerName
                        {playerId}
                    />'s ships{/if}</span
            >
            <span class="ships">
                {#each candidateShips(gameState, playerId, subject) as entry (entry.ship.shipId)}
                    {@const chosen = (pledges[playerId] ?? []).includes(entry.ship.shipId)}
                    <button
                        type="button"
                        class="ship"
                        class:on={chosen}
                        aria-pressed={chosen}
                        onclick={() => toggleShip(playerId, entry.ship.shipId)}
                        >{shipDefinition(entry.ship.shipId).name} +{entry.strength}</button
                    >
                {/each}
            </span>
        </div>
    {/each}

    {#if items.length > 0 && reward}
        <table class="shares">
            <thead>
                <tr>
                    <th></th>
                    {#each items as item (item)}
                        <th>{ITEM_LABELS[item]} ({reward[item]})</th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each partnerIds as playerId (playerId)}
                    <tr>
                        <td><PlayerName {playerId} /></td>
                        {#each items as item (item)}
                            <td>
                                <span class="stepper">
                                    <button
                                        type="button"
                                        aria-label="Less {ITEM_LABELS[item]}"
                                        onclick={() => adjustShare(playerId, item, -1)}>−</button
                                    >
                                    <span>{currentShares[playerId]?.[item] ?? 0}</span>
                                    <button
                                        type="button"
                                        aria-label="More {ITEM_LABELS[item]}"
                                        onclick={() => adjustShare(playerId, item, 1)}>+</button
                                    >
                                </span>
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}

    {#if keeps}
        <div class="partners">
            <span class="label">Keeps the tile</span>
            {#each partnerIds as playerId (playerId)}
                <button
                    type="button"
                    class="chip"
                    class:on={(keeperId ?? me) === playerId}
                    onclick={() => (keeperId = playerId)}><PlayerName {playerId} /></button
                >
            {/each}
        </div>
    {/if}

    <div class="actions">
        <span class="total" class:enough={target !== undefined && strength >= target.difficulty}
            >{strength} / {target?.difficulty ?? '?'}</span
        >
        <button type="button" class="primary" disabled={problem !== undefined} onclick={propose}
            >{existing ? 'Counter' : 'Propose pact'}</button
        >
        <button type="button" onclick={onclose}>Cancel</button>
        {#if problem}
            <span class="problem">{problem}</span>
        {/if}
    </div>
</div>

<style>
    .editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        border: 1px solid #2a3a58;
        border-radius: 8px;
        background: #0f1729;
    }

    .partners,
    .pledge,
    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 8px;
    }

    .label,
    .who {
        min-width: 110px;
        font-size: 12.5px;
        color: #9fb4d0;
    }

    .ships {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .chip,
    .ship {
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid #2f4366;
        font-size: 13px;
    }

    .chip.on,
    .ship.on,
    .chip.mine {
        border-color: #7fd3ff;
        background: #18324f;
    }

    .shares {
        font-size: 13px;
        border-collapse: collapse;
    }

    .shares th {
        padding: 2px 10px;
        font-weight: 600;
        color: #9fb4d0;
        text-align: center;
    }

    .shares td {
        padding: 2px 10px;
        text-align: center;
    }

    .stepper {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    .stepper button {
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 4px;
    }

    .total {
        font-weight: 800;
        color: #f2994a;
    }

    .total.enough {
        color: #7fe08a;
    }

    .problem {
        font-size: 12.5px;
        color: #f2c94c;
    }
</style>
