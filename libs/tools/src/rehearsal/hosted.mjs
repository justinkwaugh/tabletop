import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { Visibility } from '@tabletop/common'
import { openLocalStore, validateLocalOptions } from './localStore.mjs'
import { jsonCopy } from './replay.js'

const bind = (page) =>
    page.evaluate(async () => {
        window.rehearsalApp = (await import('/src/lib/stores/appContext.svelte.ts')).getAppContext()
    })
const waitForState = (page, count) =>
    page.waitForFunction(
        (count) => {
            const session = window.rehearsalApp?.gameService.currentGameSession
            return (
                session &&
                !session.busy &&
                !session.updatingVisibleState &&
                (count === undefined || session.gameState.actionCount === count)
            )
        },
        count,
        { timeout: 30_000 }
    )
const visibleState = (page) =>
    page.evaluate(() => {
        const session = window.rehearsalApp.gameService.currentGameSession
        return JSON.parse(JSON.stringify(session.gameState.dehydrate()))
    })
const mount = async (page, site, gameId) => {
    await page.goto(`${site}/game/${gameId}`)
    await bind(page)
    await waitForState(page)
}

export async function runHosted(rehearsal, replay, options) {
    validateLocalOptions(options)
    assert(replay.report.passed, 'Engine rehearsal must pass before hosted replay')
    const localStore = await openLocalStore(options)
    let browser
    const pages = []
    const errors = []
    const requests = { ably: 0, sse: 0 }
    const report = { passed: false, inputs: 0, requests, errors }
    let currentStep
    try {
        const accounts = await localStore.createPlayers(replay.game)
        const game = await localStore.importGame(
            replay.game,
            replay.initialState,
            [],
            accounts,
            `${rehearsal.fixture.name}: ${replay.report.variant}`
        )
        report.gameId = game.id
        await writeFile(
            `${options.output}/${replay.report.variant}-accounts.json`,
            JSON.stringify(accounts, null, 2),
            { mode: 0o600 }
        )
        browser = await chromium.launch({ headless: true, channel: 'chromium' })
        for (const account of accounts) {
            const context = await browser.newContext()
            const allowedOrigins = [new URL(options.site).origin, new URL(options.backend).origin]
            await context.route('**/*', (route) => {
                const request = route.request()
                const url = new URL(request.url())
                const isApplicationRequest = ['document', 'fetch', 'xhr', 'eventsource'].includes(
                    request.resourceType()
                )
                if (isApplicationRequest && !allowedOrigins.includes(url.origin)) {
                    errors.push(
                        `Blocked application request outside the local rehearsal: ${url.origin}`
                    )
                    return route.abort()
                }
                return route.continue()
            })
            const page = await context.newPage()
            page.on('pageerror', (error) => errors.push(error.message))
            page.on('request', (request) => {
                const url = new URL(request.url())
                if (url.hostname.endsWith('ably.io') || url.pathname.includes('/auth/ably/'))
                    requests.ably++
                if (url.pathname.includes('/sse/') && !url.pathname.endsWith('/token'))
                    requests.sse++
            })
            await page.goto(`${options.site}/login/username`)
            await page.locator('input[name=username]').fill(account.username)
            await page.locator('input[name=password]').fill(account.password)
            await page.getByRole('button', { name: 'Submit', exact: true }).click()
            await page.waitForURL(/library|dashboard/)
            await bind(page)
            pages.push(page)
        }
        assert.equal(
            requests.ably,
            0,
            'Use Redis/SSE for hosted rehearsals; disable Ably in both applications'
        )
        if (replay.report.variant === 'recorded') {
            const saved = await localStore.importGame(
                rehearsal.game,
                rehearsal.finalState,
                rehearsal.actions,
                accounts,
                `${rehearsal.fixture.name}: original export`
            )
            report.originalGameId = saved.id
            await mount(pages[0], options.site, saved.id)
            await waitForState(pages[0], rehearsal.finalState.actionCount)
            await pages[0].evaluate(() =>
                window.rehearsalApp.gameService.currentGameSession.history.goToBeginning()
            )
            await waitForState(pages[0], 0)
            let count = 0
            let stops = 0
            while (count < rehearsal.finalState.actionCount) {
                await pages[0].evaluate(() =>
                    window.rehearsalApp.gameService.currentGameSession.history.goToNextAction()
                )
                await waitForState(pages[0])
                const next = await visibleState(pages[0])
                assert(next.actionCount > count, `History stopped advancing at action ${count}`)
                count = next.actionCount
                stops++
            }
            report.history = { passed: true, stops }
        }
        await Promise.all(pages.map((page) => mount(page, options.site, game.id)))
        const checkViews = async (expected) => {
            const states = await Promise.all(pages.map(visibleState))
            const visibility = Visibility.getGameVisibility(game, rehearsal.definition.runtime)
            for (const [index, state] of states.entries()) {
                const perspective = { kind: 'player', playerId: accounts[index].playerId }
                const canonical = { ...structuredClone(expected), gameId: game.id }
                if (visibility) {
                    if (canonical.protectedPrng !== undefined) {
                        assert.deepEqual(
                            state.protectedPrng,
                            { seed: 0, invocations: 0 },
                            'Private randomness leaked to a player'
                        )
                    }
                    rehearsal.fixture.assertProtectedView?.(
                        state,
                        accounts[index].playerId,
                        canonical
                    )
                }
                const projected = visibility
                    ? visibility.state.project(canonical, perspective)
                    : canonical
                assert.deepEqual(
                    state,
                    jsonCopy(projected),
                    `Player ${index + 1} differs from canonical projection at action ${expected.actionCount}`
                )
            }
        }
        await checkViews(replay.initialState)
        for (const step of replay.steps) {
            currentStep = {
                index: step.state.actionCount - step.actions.length,
                id: step.input.id,
                type: step.input.type,
                expectedCount: step.state.actionCount
            }
            const index = accounts.findIndex((account) => account.playerId === step.input.playerId)
            assert(index >= 0, `No owning player for ${step.input.id}`)
            if (options.paceMs) await new Promise((resolve) => setTimeout(resolve, options.paceMs))
            const input = { ...step.input, gameId: game.id }
            await pages[index].evaluate(async (action) => {
                const session = window.rehearsalApp.gameService.currentGameSession
                if (!session.isPlayable || session.busy)
                    throw new Error('Game Session is not ready for the next action')
                for (const key of ['createdAt', 'updatedAt'])
                    if (action[key]) action[key] = new Date(action[key])
                await session.applyAction(action)
            }, input)
            await Promise.all(pages.map((page) => waitForState(page, step.state.actionCount)))
            await checkViews(step.state)
            report.inputs++
            if (report.inputs % 15 === 0)
                console.log(
                    `Hosted ${replay.report.variant}: ${report.inputs}/${replay.steps.length} inputs, ${step.state.actionCount} actions`
                )
        }
        const canonical = await pages[0].evaluate(
            (id) => window.rehearsalApp.api.getGame(id, { hostView: true }),
            game.id
        )
        assert.deepEqual(
            canonical.game.state,
            jsonCopy({ ...replay.finalState, gameId: game.id }),
            'Hosted final State differs from engine replay'
        )
        report.persistence = await localStore.verifyPersistence(game.id, canonical.game.state)
        await pages.at(-1).reload()
        await bind(pages.at(-1))
        await waitForState(pages.at(-1), replay.finalState.actionCount)
        await checkViews(replay.finalState)
        await pages[0].screenshot({
            path: `${options.output}/${replay.report.variant}-finished.png`,
            fullPage: true
        })
        assert.equal(requests.ably, 0)
        assert(requests.sse > 0, 'No local SSE connections were observed')
        assert.deepEqual(errors, [], 'Browser reported unhandled errors')
        report.refresh = true
        report.passed = true
    } catch (error) {
        report.failure = { step: currentStep, message: error.message }
        for (const [index, page] of pages.entries()) {
            try {
                await page.screenshot({
                    path: `${options.output}/${replay.report.variant}-failure-player-${index + 1}.png`,
                    fullPage: true
                })
                await writeFile(
                    `${options.output}/${replay.report.variant}-failure-player-${index + 1}.json`,
                    JSON.stringify(await visibleState(page), null, 2)
                )
            } catch (diagnosticError) {
                errors.push(`Unable to capture player ${index + 1}: ${diagnosticError.message}`)
            }
        }
    } finally {
        await browser?.close()
        await localStore.close()
    }
    return report
}
