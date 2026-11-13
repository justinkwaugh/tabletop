import { expect, test, type Page } from '@playwright/test'
import { pointAt } from '@tabletop/gipf-potentials'
import type { GipfPotentialsGameSession } from '../src/lib/model/session.svelte.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        gipfPotentialsSession: GipfPotentialsGameSession
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
            body: body.replace(
                'return getContext();',
                'return window.gipfPotentialsSession = getContext();'
            )
        })
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Scenarios' }).click()
    await page.getByText(name, { exact: true }).click()
    await expect.poll(() => page.evaluate(() => !!window.gipfPotentialsSession)).toBe(true)
    await settle(page)
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.gipfPotentialsSession, 'presenter')
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
        window.gipfPotentialsSession.addGameStateChangeListener(
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
        .poll(() => page.evaluate(() => window.gipfPotentialsSession.updatingVisibleState))
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
        const session = window.gipfPotentialsSession
        session.willUndo = () => {
            session.undoingMove = undefined
        }
    })
    await act(page, () => window.gipfPotentialsSession.undo())
}

function actionCount(page: Page) {
    return page.evaluate(() => window.gipfPotentialsSession.gameState.actionCount)
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
    await act(page, () => window.gipfPotentialsSession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a push", async ({ page }) => {
    await openScenario(page, 'Take a row')
    await pushE1E2(page)
    await undoAsOtherPlayer(page)
    await expectActionlessWithinBudget(page)
})

test('Undo of a row taken, and of one that freed a second row', async ({ page }) => {
    for (const scenario of ['Take a row', 'Uncovered row']) {
        await openScenario(page, scenario)
        await pushE1E2(page)
        await act(page, () => window.gipfPotentialsSession.removeChosenRow())
        await undoAsOtherPlayer(page)
    }
    await expectActionlessWithinBudget(page)
})

test('Undo of a row of GIPF-pieces left standing', async ({ page }) => {
    await openScenario(page, 'Gipf row')
    await page.evaluate(() => window.gipfPotentialsSession.chooseKind('gipf'))
    await pushE1E2(page)
    await act(page, () => window.gipfPotentialsSession.leaveRows())
    await undoAsOtherPlayer(page)
    await expectActionlessWithinBudget(page)
})

test('Undo of an extra move given up, and of one made', async ({ page }) => {
    await openScenario(page, 'Tamsk extra move')
    await pushE1E2(page)
    await act(page, () => window.gipfPotentialsSession.skipExtraMove())
    await undoAsOtherPlayer(page)
    await act(page, async () => {
        const session = window.gipfPotentialsSession
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
    await act(page, () => window.gipfPotentialsSession.skipExtraMove())
    await act(page, () => window.gipfPotentialsSession.history.goToPreviousAction())
    await act(page, () => window.gipfPotentialsSession.history.goToPreviousAction())
    await act(page, () => window.gipfPotentialsSession.history.goToNextAction())
    await act(page, () => window.gipfPotentialsSession.history.goToNextAction())
    await expectActionlessWithinBudget(page)
})

// A potential's move, from one spot to another; a PÜNCT onto a GIPF-piece covers it with `cover`.
async function movePotential(page: Page, from: string, to: string, cover?: number) {
    await page.evaluate(
        async ([from, to, cover]) => {
            const session = window.gipfPotentialsSession
            // An Undo of your own move leaves its piece chosen...
            const chosen = session.chosenFrom
            if (chosen?.q !== from.q || chosen.r !== from.r) session.chooseFrom(from)
            // ...and a PÜNCT cover its GIPF-piece too.
            if (session.chosenTo === undefined) await session.movePotential(to)
            if (cover !== undefined && session.chosenTo !== undefined) {
                await session.coverWith(cover)
            }
        },
        [pointAt(from), pointAt(to), cover] as const
    )
    await settle(page)
}

test("your own and another player's Undo of each potential's move", async ({ page }) => {
    const moves: [string, string, number?][] = [
        ['C4', 'F3'],
        ['D6', 'E6'],
        ['E3', 'B3'],
        ['G3', 'H2', 1],
        ['G3', 'H2', 2]
    ]
    for (const [from, to, cover] of moves) {
        await openScenario(page, 'Potentials')
        await movePotential(page, from, to, cover)
        expect(await actionCount(page), `${from} to ${to}`).toBe(1)
        await act(page, () => window.gipfPotentialsSession.undo())
        await page.evaluate(() => {
            const session = window.gipfPotentialsSession
            session.willUndo = () => {
                session.undoingMove = undefined
            }
        })
        await movePotential(page, from, to, cover)
        expect(await actionCount(page), `${from} to ${to} again`).toBe(1)
        await act(page, () => window.gipfPotentialsSession.undo())
    }
    await expectActionlessWithinBudget(page)
})

test("history steps through each potential's move", async ({ page }) => {
    await openScenario(page, 'Potentials')
    await movePotential(page, 'G3', 'H2', 2)
    await act(page, () => window.gipfPotentialsSession.history.goToPreviousAction())
    await act(page, () => window.gipfPotentialsSession.history.goToNextAction())
    await expectActionlessWithinBudget(page)
})
