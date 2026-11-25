<script lang="ts">
    import { m } from '$lib/paraglide/messages'
    import { Card, Hr } from 'flowbite-svelte'
    import { ExternalAuthService, externalIdentityProvider } from '@tabletop/common'
    import { getAppContext } from '@tabletop/frontend-components'
    import ReminderHoursEditor from '$lib/components/ReminderHoursEditor.svelte'
    import TurnRemindersEditor from '$lib/components/TurnRemindersEditor.svelte'
    import EmailNotificationsSetting from '$lib/components/EmailNotificationsSetting.svelte'
    import WebNotificationsSetting from '$lib/components/WebNotificationsSetting.svelte'
    import TopicRegistrationSettings from '$lib/components/TopicRegistrationSettings.svelte'

    let { authorizationService } = getAppContext()

    let user = $derived.by(() => {
        return authorizationService.getSessionUser()
    })

    let linkedAccountIdsByType: Map<string, string> = $derived.by(() => {
        return new Map(user?.externalIds?.map((id) => [externalIdentityProvider(id), id]) ?? [])
    })
</script>

<div class="flex min-h-[calc(100dvh-70px)] flex-col items-center justify-center gap-6 px-2 py-6">
    <Card size="md" class="bg-gray-300 p-4 sm:p-6">
        <div class="flex flex-col gap-3">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {m.notifications_turn_heading()}
            </h2>
            <p class="text-sm text-gray-700 dark:text-gray-300">
                {m.notifications_turn_intro()}
            </p>
        </div>

        <Hr class="my-6" />
        <div class="flex flex-col gap-3">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                {m.notifications_web_heading()}
            </h3>
            <WebNotificationsSetting />
        </div>

        <TopicRegistrationSettings
            discordLinked={linkedAccountIdsByType.has(ExternalAuthService.Discord)}
        />

        <Hr class="my-6" />
        <div class="flex flex-col gap-3">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                {m.notifications_turn_reminders_heading()}
            </h3>
            <TurnRemindersEditor />
        </div>

        <Hr class="my-6" />
        <div class="flex flex-col gap-3">
            <h3 class="text-xl font-medium text-gray-900 dark:text-white">
                {m.notifications_reminder_hours_heading()}
            </h3>
            <ReminderHoursEditor />
        </div>
    </Card>
    <Card size="md" class="bg-gray-300 p-4 sm:p-6">
        <div class="flex flex-col gap-3">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {m.notifications_email_heading()}
            </h2>
            <EmailNotificationsSetting />
        </div>
    </Card>
</div>
