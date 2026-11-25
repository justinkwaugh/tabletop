<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { onMount } from 'svelte'
    import { Button, Hr } from 'flowbite-svelte'
    import type { UserTopicRegistrations } from '@tabletop/common'
    import { isEnabled as isDiscordSigninEnabled } from '$lib/components/DiscordSignIn.svelte'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { listenForTopicRegistrationChanges } from '$lib/services/topicRegistrationUpdates'
    import { LatestRequest } from '$lib/utils/latestRequest'
    import DiscordBotNotificationsSetting from '$lib/components/DiscordBotNotificationsSetting.svelte'
    import DiscordWebhookNotificationsSetting from '$lib/components/DiscordWebhookNotificationsSetting.svelte'
    import TelegramNotificationsSetting from '$lib/components/TelegramNotificationsSetting.svelte'

    let { discordLinked }: { discordLinked: boolean } = $props()

    type Registrations =
        | { kind: 'loading' }
        | { kind: 'loaded'; registrations: UserTopicRegistrations }
        | { kind: 'failed' }

    const { api, notificationService } = getAppContext()
    const requests = new LatestRequest()
    let registrationState = $state<Registrations>({ kind: 'loading' })

    async function load() {
        const isLatest = requests.begin()
        try {
            const registrations = await api.getTopicRegistrations()
            if (isLatest()) registrationState = { kind: 'loaded', registrations }
        } catch (error) {
            console.error('Could not load notification registrations', error)
            if (isLatest()) registrationState = { kind: 'failed' }
        }
    }

    onMount(() => {
        void load()
        const unsubscribe = listenForTopicRegistrationChanges(notificationService, load)
        return () => {
            requests.cancel()
            unsubscribe()
        }
    })
</script>

{#if registrationState.kind === 'loaded'}
    {@const { discordBot, discordWebhook, telegram } = registrationState.registrations}
    {@const botOffered = isDiscordSigninEnabled && discordBot.available}
    {#if botOffered}
        <Hr class="my-6" />
        <DiscordBotNotificationsSetting registration={discordBot} {discordLinked} onchange={load} />
    {/if}

    <Hr class="my-6" />
    <DiscordWebhookNotificationsSetting
        webhook={discordWebhook}
        {discordLinked}
        {botOffered}
        onchange={load}
    />

    {#if telegram.available}
        <Hr class="my-6" />
        <TelegramNotificationsSetting registration={telegram} onchange={load} />
    {/if}
{:else if registrationState.kind === 'failed'}
    <Hr class="my-6" />
    <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
            {m.topic_registrations_load_failed()}
        </p>
        <Button color="blue" size="xs" onclick={load}>{m.try_again()}</Button>
    </div>
{/if}
