import { expect, test, type Page } from '@playwright/test'
import type { MatrxGameSession } from '../src/lib/model/session.svelte.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        matrxSession: MatrxGameSession
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2

const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
    const errors: string[] = []
    pageErrors.set(page, errors)
    page.on('pageerror', (error) => errors.push(error.message))
})

test.afterEach(({ page }) => {
    expect(pageErrors.get(page)).toEqual([])
})

async function openScenario(page: Page, name: string) {
    await page.route('**/model/sessionContext.svelte.ts*', async (route) => {
        const response = await route.fetch()
        const body = await response.text()
        await route.fulfill({
            response,
            body: body.replace('return getContext();', 'return window.matrxSession = getContext();')
        })
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.matrxSession)).toBe(true)
    await settle(page)
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.matrxSession, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { kind: '', action: '', end: 0 }
            window.steps.push(step)
            const play = context.play.bind(context)
            context.play = async () => {
                const children: { startTime(): number; duration(): number }[] =
                    context.actionTimeline.getChildren(false)
                step.end = Math.max(0, ...children.map((c) => c.startTime() + c.duration()))
                return play()
            }
            context.step = step
            return context
        }
        window.matrxSession.addGameStateChangeListener(
            async ({ kind, action, animationContext }) => {
                const step: Step = Reflect.get(animationContext, 'step')
                step.kind = kind
                step.action = action?.type ?? '-'
            }
        )
    })
}

async function settle(page: Page) {
    await expect
        .poll(() => page.evaluate(() => window.matrxSession.updatingVisibleState))
        .toBe(false)
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

async function pushE1E2(page: Page) {
    await page.locator('[aria-label="dot E1"]').click()
    await page.locator('[aria-label="push to E2"]').press('Enter')
    await settle(page)
}

// As another player's client sees an Undo: no move of this session's is being undone.
async function undoAsOtherPlayer(page: Page) {
    await page.evaluate(() => {
        const session = window.matrxSession
        session.willUndo = () => {
            session.undoingMove = undefined
        }
    })
    await act(page, () => window.matrxSession.undo())
}

async function expectActionlessWithinBudget(page: Page) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a push', async ({ page }) => {
    await openScenario(page, 'Take a row')
    await pushE1E2(page)
    await act(page, () => window.matrxSession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a push", async ({ page }) => {
    await openScenario(page, 'Take a row')
    await pushE1E2(page)
    await undoAsOtherPlayer(page)
    await expectActionlessWithinBudget(page)
})

test('Undo of a row taken, and of one that returned a GIPF piece', async ({ page }) => {
    for (const scenario of ['Take a row', 'Gipf piece back']) {
        await openScenario(page, scenario)
        await pushE1E2(page)
        await act(page, () => window.matrxSession.removeChosenRow())
        await undoAsOtherPlayer(page)
    }
    await expectActionlessWithinBudget(page)
})

test('Undo of an extra move given up, and of one made', async ({ page }) => {
    await openScenario(page, 'Tamsk extra move')
    await pushE1E2(page)
    await act(page, () => window.matrxSession.skipExtraMove())
    await undoAsOtherPlayer(page)
    await act(page, async () => {
        const session = window.matrxSession
        const entry = session.entries[0]
        session.chooseDot(entry.dot)
        await session.push(entry.line[0])
    })
    await undoAsOtherPlayer(page)
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward', async ({ page }) => {
    await openScenario(page, 'Tamsk extra move')
    await pushE1E2(page)
    await act(page, () => window.matrxSession.skipExtraMove())
    await act(page, () => window.matrxSession.history.goToPreviousAction())
    await act(page, () => window.matrxSession.history.goToPreviousAction())
    await act(page, () => window.matrxSession.history.goToNextAction())
    await act(page, () => window.matrxSession.history.goToNextAction())
    await expectActionlessWithinBudget(page)
})
