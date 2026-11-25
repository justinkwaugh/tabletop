<script lang="ts">
    import { leagueLevelName, type LeagueSeason, type LeagueSeasonSummary } from '@tabletop/common'
    import {
        leagueClosesInText,
        leagueDateText,
        leagueLevelText,
        leagueSeasonName,
        leagueSignUpOpen
    } from '$lib/utils/leaguePresentation'
    import { accountName } from '$lib/utils/accountName'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'

    let {
        season,
        summary,
        leagueId,
        usernames,
        userId,
        now,
        busy,
        onsignup,
        onwithdraw
    }: {
        season: LeagueSeason
        summary: LeagueSeasonSummary
        leagueId: string
        usernames: Record<string, string>
        userId?: string
        now: number
        busy: boolean
        onsignup: () => void
        onwithdraw: () => void
    } = $props()

    let open = $derived(leagueSignUpOpen(season, now))
    let minimum = $derived(summary.minimumPlayers)
    let players = $derived(summary.players)
    let signedUp = $derived(summary.myPlace?.status === 'signedUp')
    let heldLevel = $derived(
        summary.myPlace?.status === 'held' || summary.myPlace?.status === 'signedUp'
            ? summary.myPlace.level
            : undefined
    )
    let heldLevels = $derived.by(() => {
        const levels: { userId: string; confirmed: boolean }[][] = []
        for (const place of season.heldPlaces)
            (levels[place.level] ??= []).push({
                userId: place.userId,
                confirmed: season.confirmedIds.includes(place.userId)
            })
        return levels
    })
    let explanation = $derived(
        season.seeding
            ? m.leagues_sign_up_seeding_explanation({
                  number: season.number,
                  nextNumber: season.number + 1
              })
            : m.leagues_sign_up_held_explanation()
    )

    function name(id: string) {
        return accountName(usernames, id)
    }
</script>

{#snippet playerCount(text: string)}<span class="text-base font-semibold tabular-nums">{text}</span
    >{/snippet}
{#snippet resultsLink(text: string)}<a
        class="text-blue-700 hover:underline dark:text-blue-300"
        href={`/leagues/${leagueId}?season=${season.heldFrom}`}>{text}</a
    >{/snippet}

{#snippet chip(id: string, confirmed = true)}
    <li
        class="rounded-full px-2.5 py-0.5 text-sm {confirmed
            ? 'bg-gray-100 dark:bg-gray-700/70'
            : 'border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'} {id ===
        userId
            ? 'font-medium text-orange-700 dark:text-orange-300'
            : ''}"
        title={confirmed ? undefined : m.leagues_sign_up_not_confirmed()}
    >
        {name(id)}
    </li>
{/snippet}

<section
    aria-labelledby="sign-up-heading"
    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800/60"
>
    <div class="p-5">
        <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div class="min-w-0 max-w-xl">
                <p
                    class="text-xs font-medium uppercase tracking-wide {season.undersubscribed
                        ? 'text-amber-600 dark:text-amber-400'
                        : open
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-gray-500'}"
                >
                    {season.undersubscribed
                        ? m.leagues_status_waiting_for_players()
                        : open
                          ? m.leagues_status_sign_up_open()
                          : m.leagues_status_sign_up_closed()}
                </p>
                <h2 id="sign-up-heading" class="mt-1 font-tournament text-2xl font-semibold">
                    {leagueSeasonName(season)}
                </h2>
                <p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {explanation}
                </p>
            </div>
            {#if !season.undersubscribed}
                <div class="text-left sm:text-right">
                    <p class="text-sm font-medium">
                        {leagueClosesInText(season.signUpClosesAt, now)}
                    </p>
                    <p class="text-xs text-gray-500">{leagueDateText(season.signUpClosesAt)}</p>
                </div>
            {/if}
        </div>

        <div class="mt-5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
                <span
                    ><RichMessage
                        parts={season.seeding
                            ? m.leagues_sign_up_count_signed_up.parts({ count: players })
                            : m.leagues_sign_up_count_confirmed_or_signed_up.parts({
                                  count: players
                              })}
                        markup={{ count: playerCount }}
                    /></span
                >
                <span class="text-gray-500"
                    >{m.leagues_sign_up_needed_to_start({ count: minimum })}</span
                >
            </div>
            <div
                class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={minimum}
                aria-valuenow={Math.min(players, minimum)}
                aria-label={m.leagues_sign_up_progress_label()}
            >
                <div
                    class="h-full rounded-full {players >= minimum
                        ? 'bg-green-600'
                        : 'bg-blue-600'}"
                    style:width={`${Math.min(100, (players / minimum) * 100)}%`}
                ></div>
            </div>
            <p class="mt-1 text-xs text-gray-500">
                {players >= minimum
                    ? m.leagues_sign_up_enough()
                    : m.leagues_sign_up_more_needed({ count: minimum - players })}
                {#if season.undersubscribed}
                    {m.leagues_sign_up_waiting_for_administrator()}
                {:else}
                    {m.leagues_sign_up_groups_start_at_close()}
                {/if}
            </p>
        </div>

        {#if open}
            <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {#if signedUp}
                    <p class="text-sm font-medium text-green-700 dark:text-green-400">
                        ✓ {heldLevel !== undefined
                            ? m.leagues_sign_up_place_confirmed({
                                  level: leagueLevelName(heldLevel)
                              })
                            : m.leagues_my_place_signed_up()}
                    </p>
                    <button
                        class="text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                        disabled={busy}
                        onclick={onwithdraw}>{m.leagues_sign_up_withdraw()}</button
                    >
                {:else}
                    <button
                        class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-50"
                        disabled={busy}
                        onclick={onsignup}
                        >{heldLevel !== undefined
                            ? m.leagues_sign_up_confirm_place()
                            : m.leagues_sign_up()}</button
                    >
                    {#if heldLevel !== undefined}
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            {m.leagues_sign_up_place_held({ level: leagueLevelName(heldLevel) })}
                        </p>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>

    <div
        class="space-y-4 border-t border-gray-200 bg-gray-50/60 p-5 dark:border-gray-700/60 dark:bg-gray-900/20"
    >
        {#each heldLevels as places, level (level)}
            <div>
                <h3 class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {leagueLevelText(level)}
                    <span class="font-normal"
                        >{m.leagues_sign_up_level_confirmed({
                            confirmed: places.filter((place) => place.confirmed).length,
                            total: places.length
                        })}</span
                    >
                </h3>
                <ul class="flex flex-wrap gap-1.5">
                    {#each places as place (place.userId)}
                        {@render chip(place.userId, place.confirmed)}
                    {/each}
                </ul>
            </div>
        {/each}
        <div>
            <h3 class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {season.heldPlaces.length
                    ? m.leagues_sign_up_new_players()
                    : m.leagues_sign_up_players()}
                <span class="font-normal">· {season.newEntrants.length}</span>
            </h3>
            {#if season.newEntrants.length}
                <ul class="flex flex-wrap gap-1.5">
                    {#each season.newEntrants as entrant (entrant.userId)}
                        {@render chip(entrant.userId)}
                    {/each}
                </ul>
            {:else}
                <p class="text-sm text-gray-500">{m.leagues_sign_up_no_one_yet()}</p>
            {/if}
        </div>
        {#if season.heldFrom !== undefined}
            <p class="text-xs text-gray-500">
                <RichMessage
                    parts={m.leagues_sign_up_previous_results.parts({ number: season.heldFrom })}
                    markup={{ link: resultsLink }}
                />
            </p>
        {/if}
    </div>
</section>
