import { expect, test } from '@playwright/test'

test('routes between major workspaces and persists dark mode', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Good morning, Family/i })).toBeVisible()
  await expect(page.getByText('Household Analytics')).toBeVisible()

  await page.getByRole('link', { name: /Tasks/i }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: /Tasks and Reminders/i })).toBeVisible()

  await page.getByRole('button', { name: /Use dark mode/i }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('supports drag and drop task reassignment', async ({ page }) => {
  await page.goto('/tasks')

  const firstTask = page.locator('[data-testid^="task-card-"]').first()
  const firstHandle = page.locator('[data-testid^="drag-task-"]').first()
  const targetLane = page.locator('[data-testid^="member-lane-"]').nth(1)

  await expect(firstTask).toBeVisible()
  await expect(targetLane).toBeVisible()
  const taskTitle = await firstTask.getByRole('heading').innerText()

  await firstHandle.dragTo(targetLane)

  await expect(targetLane.getByRole('heading', { name: taskTitle })).toBeVisible()
})
