import { expect, test, type Page } from '@playwright/test'
import {
    button,
    expectNoErrors,
    openScenario,
    placeAndMove,
    press,
    settle,
    watchErrors
} from './harness.js'

// A step without an action (Undo, another player's Undo, a history step, entering, undoing in or
// leaving an exploration) must finish its motion within 0.2 s. Each AnimationContext the
// presenter makes records when its motion ends.

type Step = { kind: string; action: string; end: number }

declare global {
    interface Window {
        steps: Step[]
    }
}

const ACTIONLESS_BUDGET = 0.2

test.beforeEach(({ page }) => watchErrors(page))
test.afterEach(({ page }) => expectNoErrors(page))

async function timeSteps(page: Page) {
    await page.evaluate(() => {
        window.steps = []
        // The presenter is the session's own; the spec reaches in to time each step.
        const presenter = Reflect.get(window.punctSession, 'presenter')
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
        window.punctSession.addGameStateChangeListener(
            async ({ kind, action, animationContext }) => {
                const step: Step = Reflect.get(animationContext, 'step')
                step.kind = kind
                step.action = action?.type ?? '-'
            }
        )
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

// Every step without an action ends in time, and at least `moving` of them move something.
async function expectActionlessWithinBudget(page: Page, moving: number) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.filter((step) => step.end > 0).length).toBeGreaterThanOrEqual(moving)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a move and of a placement', async ({ page }) => {
    await openScenario(page, 'Opening')
    await placeAndMove(page)
    await timeSteps(page)
    await act(page, () => window.punctSession.undo())
    expect(await page.evaluate(() => window.punctSession.staged?.from)).toBeDefined()
    await act(page, () => window.punctSession.letGo())
    await page.evaluate(() => window.punctSession.setViewingAsNonActivePlayer(true))
    await act(page, () => window.punctSession.undo())
    await page.evaluate(() => window.punctSession.setViewingAsNonActivePlayer(false))
    expect(await page.evaluate(() => window.punctSession.gameState.actionCount)).toBe(0)
    await expectActionlessWithinBudget(page, 2)
})

test("another player's Undo of a move and of a placement", async ({ page }) => {
    await openScenario(page, 'Opening')
    await placeAndMove(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.punctSession.willUndo = () => {}
    })
    await act(page, () => window.punctSession.undo())
    expect(await page.evaluate(() => window.punctSession.staged)).toBeUndefined()
    await act(page, () => window.punctSession.undo())
    expect(await page.evaluate(() => window.punctSession.gameState.actionCount)).toBe(0)
    await expectActionlessWithinBudget(page, 2)
})

test('history steps back and forward, and jumps to either end', async ({ page }) => {
    await openScenario(page, 'Opening')
    await placeAndMove(page)
    await timeSteps(page)
    await act(page, () => window.punctSession.history.goToPreviousAction())
    await act(page, () => window.punctSession.history.goToPreviousAction())
    await act(page, () => window.punctSession.history.goToNextAction())
    await act(page, () => window.punctSession.history.goToEnd())
    await act(page, () => window.punctSession.history.goToBeginning())
    await act(page, () => window.punctSession.history.goToEnd())
    await expectActionlessWithinBudget(page, 6)
})

test('entering an exploration, undoing in it and leaving it', async ({ page }) => {
    await openScenario(page, 'Opening')
    await placeAndMove(page)
    await timeSteps(page)
    await act(page, () => window.punctSession.startExploring())
    await press(page, 'space C11')
    await button(page, 'Place').click()
    await settle(page)
    await act(page, () => window.punctSession.undo())
    await act(page, () => window.punctSession.letGo())
    await press(page, 'space C11')
    await button(page, 'Place').click()
    await settle(page)
    await act(page, () => window.punctSession.explorations.endExploring())
    expect(await page.evaluate(() => window.punctSession.isExploring)).toBe(false)
    await expectActionlessWithinBudget(page, 2)
})
