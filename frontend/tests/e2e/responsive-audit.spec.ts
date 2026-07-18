import { expect, test, type Page } from '@playwright/test'

const routes = [
  '/',
  '/tasks',
  '/groceries',
  '/meals',
  '/family',
  '/analytics',
  '/assistant',
  '/command-center',
  '/history',
  '/demo',
]

const viewports = [
  { name: 'desktop', size: { width: 1440, height: 960 } },
  { name: 'iphone-se', size: { width: 375, height: 667 } },
  { name: 'ipad', size: { width: 820, height: 1180 } },
]

const signIn = async (page: Page, path: string, viewportName: string) => {
  await page.setViewportSize(viewports.find((viewport) => viewport.name === viewportName)?.size ?? viewports[0].size)
  await page.goto(path)
  await page.evaluate((id) => {
    localStorage.setItem('fridgehub-device-id', id)
    localStorage.setItem('fridgehub-device-name', 'Playwright Responsive Browser')
  }, `fridgehub-responsive-${viewportName}-${test.info().parallelIndex}`)
  await page.getByLabel('Username').fill('meera')
  await page.getByLabel('Password').fill('fridgehub')
  await page.getByRole('button', { name: /^Sign in$/i }).click()
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night), Meera/i })).toBeVisible()
}

const expectNoDocumentOverflow = async (page: Page) => {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          className: element.className.toString(),
          tag: element.tagName.toLowerCase(),
          text: element.innerText?.replace(/\s+/g, ' ').slice(0, 90) ?? '',
          width: rect.width,
          x: rect.x,
        }
      })
      .filter((item) => item.width > 0 && item.x + item.width > viewportWidth + 1)
      .slice(0, 8)

    return {
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      offenders,
      viewportWidth,
    }
  })

  expect(result.bodyScrollWidth, JSON.stringify(result, null, 2)).toBeLessThanOrEqual(result.viewportWidth + 1)
  expect(result.documentScrollWidth, JSON.stringify(result, null, 2)).toBeLessThanOrEqual(result.viewportWidth + 1)
}

const expectResponsiveChrome = async (page: Page, viewportWidth: number) => {
  const headerHeight = await page.locator('header').evaluate((element) => element.getBoundingClientRect().height)
  const maxHeaderHeight = viewportWidth < 640 ? 220 : viewportWidth < 1024 ? 180 : 190

  expect(headerHeight).toBeLessThanOrEqual(maxHeaderHeight)

  if (viewportWidth < 640) {
    await expect(page.getByTitle('Search (Ctrl K)')).toBeHidden()
  } else {
    await expect(page.getByTitle('Search (Ctrl K)')).toBeVisible()
  }

  if (viewportWidth < 1024) {
    await expect(page.getByTitle('Sign out')).toBeHidden()
  } else {
    await expect(page.getByTitle('Sign out')).toBeVisible()
  }
}

for (const viewport of viewports) {
  test.describe(`responsive audit - ${viewport.name}`, () => {
    test.use({ viewport: viewport.size })

    for (const route of routes) {
      test(`${route} has stable app chrome and no page overflow`, async ({ page }) => {
        await signIn(page, route, viewport.name)
        await expect(page.locator('main')).toBeVisible()

        if (viewport.size.width >= 1024) {
          await expect(page.getByRole('complementary').first()).toBeVisible()
        } else {
          await expect(page.getByRole('navigation').last()).toBeVisible()
        }

        await expectResponsiveChrome(page, viewport.size.width)
        await expectNoDocumentOverflow(page)
      })
    }
  })
}
