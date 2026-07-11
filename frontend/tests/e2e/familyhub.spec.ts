import { expect, test } from '@playwright/test'

const signIn = async (page: import('@playwright/test').Page, path = '/') => {
  await page.goto(path)
  await page.getByLabel('Username').fill('meera')
  await page.getByLabel('Password').fill('familyhub')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Meera/i })).toBeVisible()
}

test('routes between major workspaces and persists dark mode', async ({ page }) => {
  await signIn(page)

  await expect(page.getByText('Weekly family health')).toBeVisible()
  await expect(page.getByRole('button', { name: /Open history/i })).toBeVisible()

  await page.getByRole('link', { name: /Tasks/i }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: /Tasks & Reminders/i })).toBeVisible()

  await page.getByRole('link', { name: /History/i }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('heading', { name: /Every important change/i })).toBeVisible()

  await page.getByRole('button', { name: /Use dark mode/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('supports task reassignment from the board', async ({ page }) => {
  await signIn(page, '/tasks')

  const lanes = page.locator('[data-testid^="member-lane-"]')
  const laneCount = await lanes.count()
  let sourceLaneIndex = 0

  for (let index = 0; index < laneCount; index += 1) {
    if ((await lanes.nth(index).locator('[data-testid^="task-card-"]').count()) > 0) {
      sourceLaneIndex = index
      break
    }
  }

  const sourceLane = lanes.nth(sourceLaneIndex)
  const targetLane = lanes.nth(sourceLaneIndex === 0 ? 1 : 0)
  const firstTask = sourceLane.locator('[data-testid^="task-card-"]').first()

  await expect(firstTask).toBeVisible()
  await expect(targetLane).toBeVisible()
  const taskTitle = await firstTask.getByRole('heading').innerText()
  const targetMemberName = await targetLane.getByRole('heading').first().innerText()

  await firstTask.getByLabel(`Reassign ${taskTitle}`).selectOption({ label: targetMemberName })

  await expect(targetLane.getByRole('heading', { name: taskTitle })).toBeVisible()
})
