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
        Heading
    } from 'flowbite-svelte'
    import darkLogo from '$lib/components/images/dark-logo.png'
    import { goto } from '$app/navigation'
    import { getContext, onMount } from 'svelte'
    import GameEditForm from '$lib/components/GameEditForm.svelte'
    import { UserStatus } from '@tabletop/common'
    import type { AppContext } from '$lib/stores/appContext.svelte'
    import { BellSolid } from 'flowbite-svelte-icons'

    let { api, authorizationService, gameService, notificationService } = getContext(
        'appContext'
    ) as AppContext

    let { children } = $props()

    let sessionUser = $derived(authorizationService.getSessionUser())
    let showCreateGameModel = $state(false)

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

    async function gotoDashboard() {
        await goto('/dashboard')
    }

    async function gotoAbout() {
        await goto('/about')
    }

    function createGame() {
        showCreateGameModel = true
    }

    async function closeCreateModal() {
        showCreateGameModel = false
        await gotoDashboard()
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
    }

    onMount(() => {
        notificationService.onMounted()
    })

    const slideParams = { axis: 'y', duration: 600 }
</script>

{#snippet gameName()}
    {#if gameService.currentGameSession}
        <Heading
            class="text-nowrap text-center mt-2 sm:mt-0 max-w-[320px] dark:text-gray-200 font-medium tight overflow-clip text-ellipsis"
            customSize=""
            style=""
            tag="h4">{gameService.currentGameSession.game.name}</Heading
        >
    {/if}
{/snippet}

<Navbar fluid={true} class="bg-gray-100">
    <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center w-full">
            <div class="flex justify-center items-center">
                <NavBrand href="/" class="shrink-0 cursor-pointer">
                    <img src={darkLogo} alt="Board Together" class="h-8 w-auto" />
                </NavBrand>

                <div
                    class="hidden sm:block rounded-lg py-2 px-2 md:px-4 flex flex-col justify-start items-start ml-4"
                >
                    {@render gameName()}
                </div>
            </div>
            <div class="flex items-center">
                <NavUl>
                    <NavLi href="/about">About Us</NavLi>
                </NavUl>
                {#if sessionUser}
                    {#if sessionUser.status === UserStatus.Active}
                        <Button size="xs" color="blue" class="me-4 h-[30px]" onclick={createGame}
                            >New Game</Button
                        >
                    {/if}

                    <Avatar id="user-drop" class="cursor-pointer" rounded />
                    <Dropdown triggeredBy="#user-drop">
                        <DropdownHeader>
                            <span class="block text-sm"
                                >{sessionUser.username || 'username not assigned'}</span
                            >
                        </DropdownHeader>
                        {#if sessionUser.status === UserStatus.Active}
                            <DropdownItem onclick={gotoDashboard}>Dashboard</DropdownItem>
                        {/if}
                        <DropdownItem onclick={gotoProfile}>Profile</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem onclick={gotoAbout} class="md:hidden">About us</DropdownItem>
                        <DropdownDivider class="md:hidden" />
                        {#if authorizationService.isAdmin}
                            <li>
                                <Toggle
                                    bind:checked={authorizationService.debugViewEnabled}
                                    class="rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    >Debug</Toggle
                                >
                            </li>{/if}
                        <DropdownItem onclick={logout}>Sign out</DropdownItem>
                    </Dropdown>
                {/if}
            </div>
        </div>
        <div class="flex justify-center sm:hidden w-fulloverflow-hidden">
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
{#if notificationService.shouldShowPrompt()}
    <Banner
        id="default-banner"
        position="relative"
        bannerType="info"
        dismissable={false}
        classInner="w-full"
    >
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
