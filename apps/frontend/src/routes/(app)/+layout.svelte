<script lang="ts">
    import '../../app.css'
    import {
        Navbar,
        NavBrand,
        Avatar,
        Button,
        Dropdown,
        DropdownHeader,
        DropdownDivider,
        DropdownItem,
        Modal,
        Banner,
        NavUl,
        NavLi,
        Toggle,
        Heading,
        Alert,
        DropdownGroup
    } from 'flowbite-svelte'
    import darkLogo from '$lib/components/images/dark-logo.png'
    import { goto } from '$app/navigation'
    import { onMount } from 'svelte'
    import { UserStatus } from '@tabletop/common'
    import { VersionChange, GameEditForm, getAppContext } from '@tabletop/frontend-components'
    import { toast } from 'svelte-sonner'
    import { onceMounted } from '$lib/components/RunOnceMounted.svelte'
    import { BellSolid } from 'flowbite-svelte-icons'

    let {
        api,
        authorizationService,
        gameService,
        notificationService,
        visibilityService,
        libraryService,
        manifestService
    } = getAppContext()
    let titlesById = $derived(libraryService.titlesById)
    let loading = $derived(libraryService.loading)

    let { children } = $props()

    let sessionUser = $derived(authorizationService.getSessionUser())
    let showCreateGameModel = $state(false)
    let showCancelPrompt = $state(false)

    let seed = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame

        if (!authorizationService.isAdmin) {
            return undefined
        }

        return game.seed
    })

    let gameLogicVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getLogicVersion(game.typeId)
    })

    let gameUiVersion = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        const game = gameService.currentGameSession.primaryGame
        return manifestService.getUiVersion(game.typeId)
    })

    let currentDefinition = $derived.by(() => {
        if (!gameService.currentGameSession) {
            return undefined
        }

        return titlesById[gameService.currentGameSession.primaryGame.typeId]
    })

    async function onLogout() {
        await api.logout()
        gameService.clear()
        await authorizationService.onLogout()
    }

    const logoutChannel = new BroadcastChannel('logout')
    logoutChannel.onmessage = function (e) {
        onLogout()
    }

    async function logout() {
        onLogout()
        logoutChannel.postMessage({})
    }

    async function gotoProfile() {
        await goto('/profile')
    }

    async function gotoPreferences() {
        showCancelPrompt = false
        await goto('/preferences')
    }

    async function gotoNotifications() {
        showCancelPrompt = false
        await goto('/notifications')
    }

    async function gotoDashboard() {
        await goto('/dashboard')
    }

    async function gotoAbout() {
        await goto('/about')
    }

    function createGame() {
        if (loading) {
            toast.info('Loading game library...')
            return
        }
        showCreateGameModel = true
    }

    async function closeCreateModal() {
        showCreateGameModel = false
    }

    async function onGameCreate() {
        await closeCreateModal()
        notificationService.showPrompt()
    }

    const loginChannel = new BroadcastChannel('login')
    loginChannel.onmessage = async function (e) {
        if (e.data.status === 'success' && e.data.user) {
            await authorizationService.onLogin(e.data.user)
        }
    }

    const userUpdateChannel = new BroadcastChannel('userUpdated')
    userUpdateChannel.onmessage = function (e) {
        const user = e.data.user
        authorizationService.setSessionUser(user)
    }

    async function requestNotificationPermission() {
        notificationService.hidePrompt()
        await notificationService.requestWebNotificationPermission()
    }

    async function dismissPrompt() {
        notificationService.hidePrompt()
        showCancelPrompt = true
    }

    onMount(() => {
        notificationService.onMounted()
        visibilityService.setDocument(document)
        if (/mobile/i.test(navigator.userAgent ?? '') && !location.hash) {
            window.scrollTo(0, 1)
        }
    })

    $effect(() => {
        const versionChange = api.versionChange
        switch (versionChange) {
            case VersionChange.MajorUpgrade:
            case VersionChange.Rollback:
                console.log('Major upgrade detected')
                onceMounted(() => {
                    toast.warning(
                        'The site has been updated and requires a page refresh.  Refreshing in 5 seconds',
                        {
                            duration: Number.POSITIVE_INFINITY,
                            classes: {
                                closeButton: 'hidden'
                            }
                        }
                    )
                    setTimeout(() => {
                        location.reload()
                    }, 5000)
                })
                break
            case VersionChange.MinorUpgrade:
                console.log('Minor upgrade detected')
                onceMounted(() => {
                    toast.info(
                        'The site has been updated with new features or fixes, please refresh the page when you have a moment',
                        {
                            duration: Number.POSITIVE_INFINITY
                        }
                    )
                })
                break
            default:
                break
        }
    })

</script>

{#snippet gameName()}
    {#if gameService.currentGameSession}
        <Heading
            class="text-nowrap text-center mt-2 sm:mt-0 max-w-[320px] dark:text-gray-200 font-medium tight overflow-clip text-ellipsis"
            style=""
            tag="h4"
            >{currentDefinition?.info.metadata.beta ? 'BETA: ' : ''}{gameService.currentGameSession
                .primaryGame.name}</Heading
        >
    {/if}
{/snippet}

{#snippet gameSeed()}
    {#if seed}
        <div
            class="text-nowrap text-center mb-2 sm:mb-0 max-w-[320px] dark:text-gray-400 font-mono text-xs overflow-clip text-ellipsis"
            style=""
        >
            Seed: {seed}
        </div>
    {/if}
{/snippet}

<Navbar
    fluid={true}
    class="{currentDefinition?.info.metadata.beta ? 'dark:bg-red-900' : 'dark:bg-gray-800'} "
>
    <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center w-full">
            <div class="flex justify-center items-center">
                <NavBrand href="/library" class="shrink-0 cursor-pointer">
                    <img src={darkLogo} alt="Board Together" class="h-8 w-auto" />
                </NavBrand>

                <div
                    class="hidden sm:block rounded-lg py-2 px-2 md:px-4 flex flex-col justify-start items-start ml-4"
                >
                    {@render gameName()}
                </div>
            </div>
            <div class="flex items-center">
                <NavUl
                    classes={{
                        ul: 'flex flex-col py-0 px-4 mt-4 md:flex-row md:space-x-8 rtl:space-x-reverse md:mt-0 md:text-sm md:font-medium'
                    }}
                >
                    <NavLi href="/about">About Us</NavLi>
                </NavUl>
                {#if sessionUser}
                    {#if sessionUser.status === UserStatus.Active}
                        <Button size="xs" color="blue" class="me-4 h-[30px]" onclick={gotoDashboard}
                            >My Games</Button
                        >
                    {/if}

                    <Avatar id="user-drop" class="cursor-pointer" />
                    <Dropdown triggeredBy="#user-drop">
                        <DropdownGroup class="py-1">
                            <DropdownHeader class="py-2">
                                <span class="block text-sm"
                                    >{sessionUser.username || 'username not assigned'}</span
                                >
                            </DropdownHeader>
                            <DropdownDivider />
                            <DropdownItem class="w-full text-left" onclick={gotoProfile}
                                >Profile</DropdownItem
                            >
                            <DropdownItem class="w-full text-left" onclick={gotoPreferences}
                                >Preferences</DropdownItem
                            >
                            <DropdownItem class="w-full text-left" onclick={gotoNotifications}
                                >Notifications</DropdownItem
                            >
                            <DropdownDivider />
                            <DropdownItem onclick={gotoAbout} class="md:hidden w-full text-left"
                                >About us</DropdownItem
                            >

                            <DropdownDivider class="md:hidden" />
                            {#if authorizationService.isAdmin}
                                <li>
                                    <Toggle
                                        bind:checked={authorizationService.debugViewEnabled}
                                        class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        >Debug</Toggle
                                    >
                                </li>
                                <li>
                                    <Toggle
                                        bind:checked={authorizationService.adminCapabilitiesEnabled}
                                        class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                        >Admin</Toggle
                                    >
                                </li>
                            {/if}
                            <DropdownItem class="w-full text-left" onclick={logout}
                                >Sign out</DropdownItem
                            >
                            {#if authorizationService.isAdmin}
                                <DropdownDivider />
                                <DropdownItem
                                    class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                    >FE: v{manifestService.getFrontendVersion()}</DropdownItem
                                >
                                {#if gameLogicVersion}
                                    <DropdownItem
                                        class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                        >Logic: v{gameLogicVersion ?? 'N/A'}</DropdownItem
                                    >
                                {/if}
                                {#if gameUiVersion}
                                    <DropdownItem
                                        class="w-full text-left dark:text-gray-400 font-mono text-xs py-1"
                                        >UI: v{gameUiVersion ?? 'N/A'}</DropdownItem
                                    >
                                {/if}
                                {#if seed}
                                    <DropdownItem class="w-full text-left py-1"
                                        >{@render gameSeed()}</DropdownItem
                                    >
                                {/if}
                            {/if}
                        </DropdownGroup>
                    </Dropdown>
                {/if}
            </div>
        </div>
        <div class="flex justify-center sm:hidden w-full overflow-hidden text-ellipsis">
            {@render gameName()}
        </div>
    </div>
</Navbar>
<Modal
    bind:open={showCreateGameModel}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <GameEditForm oncancel={() => closeCreateModal()} onsave={(game) => onGameCreate()} />
</Modal>
<Modal
    bind:open={showCancelPrompt}
    size="xs"
    autoclose={false}
    class="w-full"
    outsideclose
    dismissable={false}
    onclick={(e) => e.stopPropagation()}
>
    <Alert color="blue" class="dark:bg-transparent dark:text-blue-400">
        <div class="flex items-center gap-3">
            <span class="text-lg font-medium">Just so you know...</span>
        </div>
        <p class="mt-2 mb-4 text-sm">
            If you do not want to be prompted about notifications any more, you can configure that
            in your prefences.
        </p>
        <div class="flex gap-2">
            <Button
                onclick={() => {
                    showCancelPrompt = false
                }}
                size="xs"
                color="blue">Got it</Button
            >
            <Button onclick={() => gotoPreferences()} size="xs" outline color="light"
                >Go to Preferences</Button
            >
        </div>
    </Alert>
</Modal>
{#if notificationService.shouldShowPrompt()}
    <Banner id="default-banner" class="relative" type="top" dismissable={false}>
        <div class="flex items-center justify-between w-full">
            <div class="flex items-center">
                <p class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
                    <span class="inline-flex p-1 me-3 bg-gray-200 rounded-full dark:bg-gray-600">
                        <BellSolid class="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span class="sr-only">Light bulb</span>
                    </span>
                    <span>
                        Receive notifications about game invitations and to let you know it is your
                        turn?
                    </span>
                </p>
                <Button
                    onclick={() => requestNotificationPermission()}
                    color="blue"
                    class="ms-4 max-h-[24px]"
                    size="xs">Allow</Button
                >
            </div>

            <div class="flex">
                <Button
                    onclick={() => dismissPrompt()}
                    color="light"
                    class="ms-4 max-h-[24px]"
                    size="xs">Close</Button
                >
            </div>
        </div></Banner
    >
{/if}
{@render children()}
