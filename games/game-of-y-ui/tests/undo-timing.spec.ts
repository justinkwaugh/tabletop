import { expect, test, type Page } from '@playwright/test'
import { expectNoErrors, openScenario, press, settle, watchErrors } from './harness.js'

// A step without an action (Undo, another player's Undo, a history step) must finish its motion
// within 0.2 s. Each AnimationContext the presenter makes records when its motion ends.

// `fades` holds the opacity each of the step's tweens ends at: 0 lifts a stone off, 1 drops one in.
type Step = { kind: string; action: string; end: number; fades: number[] }

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
        const presenter = Reflect.get(window.ySession, 'presenter')
        const deps = Reflect.get(presenter, 'deps')
        const create = deps.createAnimationContext
        deps.createAnimationContext = () => {
            const context = create()
            const step: Step = { kind: '', action: '', end: 0, fades: [] }
            window.steps.push(step)
            const play = context.play.bind(context)
            context.play = async () => {
                const children: { startTime(): number; duration(): number }[] =
                    context.actionTimeline.getChildren(false)
                step.end = Math.max(0, ...children.map((c) => c.startTime() + c.duration()))
                const tweens: { vars: { opacity?: number } }[] = context.actionTimeline.getChildren(
                    true,
                    true,
                    false
                )
                step.fades = tweens.flatMap(({ vars }) =>
                    vars.opacity === undefined ? [] : [vars.opacity]
                )
                return play()
            }
            context.step = step
            return context
        }
        window.ySession.addGameStateChangeListener(async ({ kind, action, animationContext }) => {
            const step: Step = Reflect.get(animationContext, 'step')
            step.kind = kind
            step.action = action?.type ?? '-'
        })
    })
}

async function act(page: Page, run: () => unknown) {
    await page.evaluate(run)
    await settle(page)
}

async function expectActionlessWithinBudget(page: Page) {
    const steps = await page.evaluate(() => window.steps)
    const actionless = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(actionless.length).toBeGreaterThan(0)
    for (const step of actionless) {
        expect(step.end, `${step.kind} step`).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    }
}

test('your own Undo of a placement', async ({ page }) => {
    await openScenario(page, 'Swap or place')
    await press(page, 'place on F5')
    await settle(page)
    await timeSteps(page)
    await act(page, () => window.ySession.undo())
    await expectActionlessWithinBudget(page)
})

test("another player's Undo of a placement", async ({ page }) => {
    await openScenario(page, 'Swap or place')
    await press(page, 'place on F5')
    await settle(page)
    await timeSteps(page)
    // As another client sees an Undo: no move of this session's is being taken back.
    await page.evaluate(() => {
        window.ySession.willUndo = () => {}
    })
    await act(page, () => window.ySession.undo())
    await expectActionlessWithinBudget(page)
})

test('history steps back and forward, and jumps to either end, ringing the winning chain', async ({
    page
}) => {
    await openScenario(page, 'One from a y')
    await act(page, () => window.ySession.placeStone('C1'))
    expect(await page.evaluate(() => window.ySession.gameState.winningPlayerIds)).toHaveLength(1)
    await timeSteps(page)
    await act(page, () => window.ySession.history.goToPreviousAction())
    await act(page, () => window.ySession.history.goToNextAction())
    await act(page, () => window.ySession.history.goToBeginning())
    await act(page, () => window.ySession.history.goToEnd())
    await expectActionlessWithinBudget(page)
})

// The exploration's Undo and the move after it put stone 1 on another point than the game's, so
// leaving the exploration lifts that stone off and drops the game's in, rather than moving it.
test('leaving an exploration whose stone stands elsewhere lifts it and drops the other', async ({
    page
}) => {
    await openScenario(page, 'Swap or place')
    await press(page, 'place on F5')
    await settle(page)
    await act(page, () => window.ySession.startExploring())
    await act(page, () => window.ySession.undo())
    await press(page, 'place on D4')
    await settle(page)
    await timeSteps(page)
    await act(page, () => window.ySession.explorations.endExploring())
    expect(await page.evaluate(() => window.ySession.isExploring)).toBe(false)
    const steps = await page.evaluate(() => window.steps)
    const leaving = steps.filter((step) => step.action === '-' && step.kind !== '')
    expect(leaving).toHaveLength(1)
    const [{ end, fades }] = leaving
    expect(end).toBeGreaterThan(0)
    expect(end).toBeLessThanOrEqual(ACTIONLESS_BUDGET)
    expect(fades, 'a stone lifts off').toContain(0)
    expect(fades, 'a stone drops in').toContain(1)
})
