<script lang="ts">
    import { MachineState } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { calledKingName, describeAction } from '$lib/utils/actionDescription.js'
    import { announcementsSummary } from '$lib/utils/announcementText.js'
    import AnnouncementChoices from './AnnouncementChoices.svelte'
    import { bidHeading, contractSummary, meinSpielSummary } from '$lib/utils/contractText.js'
    import ContractMenu from './ContractMenu.svelte'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }
    const turnPlayerId = $derived(state.activePlayerIds[0])

    const Waiting: Partial<Record<MachineState, string>> = {
        [MachineState.Bidding]: 'to bid',
        [MachineState.ChoosingContract]: 'to name the contract',
        [MachineState.CallingKing]: 'to call a king',
        [MachineState.ChoosingTalonHalf]: 'to take half of the talon',
        [MachineState.LayingAway]: 'to lay away cards',
        [MachineState.Announcing]: 'to announce',
        [MachineState.Playing]: 'to play a card'
    }

    const waitingFor = $derived(
        state.machineState === MachineState.ChoosingTalonHalf && state.isCalledKingInTalon()
            ? 'to give up or play alone'
            : Waiting[state.machineState]
    )

    const lastAction = $derived(
        gameSession.actions.findLast((action) =>
            describeAction(action, names, gameSession.cardStyle)
        )
    )
    const lastDescription = $derived(
        lastAction ? describeAction(lastAction, names, gameSession.cardStyle) : undefined
    )
    const historyDescription = $derived(
        gameSession.currentAction
            ? describeAction(gameSession.currentAction, names, gameSession.cardStyle)
            : undefined
    )

    const standingContract = $derived.by(() => {
        if (state.machineState === MachineState.Bidding && state.auction.bid) {
            const { playerId, ...choice } = state.auction.bid
            return { label: 'Highest bid', playerId, choice }
        }
        if (state.machineState === MachineState.Announcing && state.contract) {
            const { contract, bird, declarerId } = state.contract
            return { label: 'Contract', playerId: declarerId, choice: { contract, bird } }
        }
        return undefined
    })

    const announced = $derived(
        state.announcements &&
            (state.machineState === MachineState.Announcing ||
                state.machineState === MachineState.Playing)
            ? announcementsSummary(state.announcements, names)
            : []
    )
</script>

<div class="action-area">
    {#if gameSession.isViewingHistory}
        <p>{historyDescription ?? 'The deal'}</p>
    {:else if state.result}
        <p class="headline">
            {state.winningPlayerIds
                .map((playerId) => gameSession.getPlayerName(playerId))
                .join(' and ')}
            {state.winningPlayerIds.length === 1 ? 'wins' : 'win'}!
        </p>
        <p>
            {state.players
                .toSorted((a, b) => b.score - a.score)
                .map((player) => `${gameSession.getPlayerName(player.playerId)} ${player.score}`)
                .join(' · ')}
        </p>
    {:else if gameSession.isMyTurn}
        {#if state.machineState === MachineState.Bidding}
            <p>Bid for the contract{gameSession.canSayMeinSpiel ? ', or reserve the game' : ''}.</p>
            <div class="choices">
                {#if gameSession.biddableChoices.length > 0}
                    <ContractMenu
                        label="Bid"
                        title="Choose your bid"
                        choices={gameSession.biddableChoices}
                        onchoose={(choice) => gameSession.bid(choice)}
                    />
                {/if}
                {#if gameSession.canSayMeinSpiel}
                    <button
                        type="button"
                        class="choice"
                        title={meinSpielSummary()}
                        onclick={() => gameSession.sayMeinSpiel()}>Mein Spiel</button
                    >
                {/if}
                {#if gameSession.canPass}
                    <button type="button" class="choice quiet" onclick={() => gameSession.pass()}
                        >Pass</button
                    >
                {/if}
            </div>
            {#if gameSession.canSayMeinSpiel}
                <p class="note"><strong>Mein Spiel:</strong> {meinSpielSummary()}</p>
            {/if}
        {:else if state.machineState === MachineState.ChoosingContract}
            <p>Nobody outbid your “Mein Spiel”. Name your contract.</p>
            <div class="choices">
                <ContractMenu
                    label="Name contract"
                    title="Name your contract"
                    choices={gameSession.nameableChoices}
                    onchoose={(choice) => gameSession.chooseContract(choice)}
                    openAtOnce
                />
            </div>
        {:else if state.machineState === MachineState.CallingKing}
            <p>Call a king. Its holder becomes your secret partner.</p>
            <div class="choices">
                {#each gameSession.callableKings as king (king)}
                    <button type="button" class="choice" onclick={() => gameSession.callKing(king)}
                        >{calledKingName(king)}</button
                    >
                {/each}
            </div>
        {:else if state.machineState === MachineState.ChoosingTalonHalf}
            {#if gameSession.canGiveUp}
                <p>
                    The called King is in the talon. Give up and pay {gameSession.gameValue} to each player,
                    or take a half and play alone against all three for {gameSession.gameValue}
                    from each. Kontra is not allowed.
                </p>
                <div class="choices">
                    <button type="button" class="choice" onclick={() => gameSession.giveUp()}
                        >Give up</button
                    >
                </div>
            {:else}
                <p>Take one half of the talon. The other half goes to your opponents.</p>
            {/if}
        {:else if state.machineState === MachineState.LayingAway}
            <p>
                Choose {gameSession.layAwayCount} cards to lay away ({gameSession.chosenToLayAway
                    .length}/{gameSession.layAwayCount}). Kings and the Trull may not be laid away;
                trumps only when you have no other choice.
            </p>
            <div class="choices">
                <button
                    type="button"
                    class="choice"
                    disabled={!gameSession.canConfirmLayAway}
                    onclick={() => gameSession.confirmLayAway()}>Lay away</button
                >
            </div>
        {:else if state.machineState === MachineState.Announcing}
            <AnnouncementChoices />
        {:else if state.machineState === MachineState.Playing}
            <p>
                {#if gameSession.pickedCard}
                    Click the raised card again, or drag it onto the table, to play it.
                {:else}
                    Play a card{state.trick?.plays.length ? '' : ' to lead the trick'}: click it
                    twice, or drag it onto the table.
                {/if}
            </p>
        {/if}
    {:else}
        <p>
            {#if turnPlayerId}
                Waiting for {gameSession.getPlayerName(turnPlayerId)}
                {waitingFor ?? ''}.
            {/if}
            {#if lastDescription}<span class="last">{lastDescription}.</span>{/if}
        </p>
    {/if}
    {#if standingContract && !gameSession.isViewingHistory}
        <p class="standing">
            <span>{standingContract.label}:</span>
            <strong
                >{gameSession.getPlayerName(standingContract.playerId)}’s {bidHeading(
                    standingContract.choice
                )}.</strong
            >
            {contractSummary(standingContract.choice)}
        </p>
    {/if}
    {#if announced.length > 0 && !gameSession.isViewingHistory}
        <p class="announced"><span>Announced:</span> {announced.join(' · ')}</p>
    {/if}
</div>

<style>
    .action-area {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px 14px 10px;
        font-size: 0.95rem;
    }

    .headline {
        font-size: 1.1rem;
        font-weight: 700;
        color: #f2c94c;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .choice:disabled {
        opacity: 0.4;
    }

    .quiet {
        border-style: dashed;
    }

    .note {
        font-size: 0.8rem;
        opacity: 0.75;
    }

    .standing,
    .announced {
        font-size: 0.85rem;
        line-height: 1.3;
        opacity: 0.85;
    }

    .standing span,
    .announced span {
        color: #f2c94c;
        font-weight: 600;
    }

    .last {
        margin-left: 6px;
        opacity: 0.75;
    }

    @media (max-width: 640px) {
        .action-area {
            gap: 4px;
            padding: 2px 8px 6px;
            font-size: 0.85rem;
            line-height: 1.3;
        }

        .choices {
            gap: 4px;
        }

        .note,
        .standing,
        .announced {
            font-size: 0.75rem;
        }
    }
</style>
