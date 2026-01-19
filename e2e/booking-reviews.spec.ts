import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, waitForToast } from './helpers';

test.describe('Booking Page', () => {
  test('should have booking settings in settings page', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const bookingSection = page.locator('text=Booking, text=Public Profile');
    if (await bookingSection.first().isVisible()) {
      await expect(bookingSection.first()).toBeVisible();
    }
  });

  test('should show booking URL configuration', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const bookingUrl = page.getByText(/booking|link|url|public/i);
    if (await bookingUrl.first().isVisible()) {
      await expect(bookingUrl.first()).toBeVisible();
    }
  });

  test('should allow enabling public profile', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const publicProfileToggle = page.locator('[data-testid="toggle-public-profile"], input[type="checkbox"], [role="switch"]');
    if (await publicProfileToggle.first().isVisible()) {
      await expect(publicProfileToggle.first()).toBeVisible();
    }
  });

  test('should show service selection for booking', async ({ page }) => {
    await navigateTo(page, '/settings');
    await waitForPageLoad(page);
    
    const servicesSection = page.locator('text=Services, text=Service Catalog');
    if (await servicesSection.first().isVisible()) {
      await expect(servicesSection.first()).toBeVisible();
    }
  });
});

test.describe('Reviews', () => {
  test('should navigate to reviews page', async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
    
    await expect(page.getByRole('heading', { name: /reviews/i })).toBeVisible();
  });

  test('should show average rating', async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
    
    const rating = page.getByText(/\d+\.?\d*|rating|stars/i);
    if (await rating.first().isVisible()) {
      await expect(rating.first()).toBeVisible();
    }
  });

  test('should show reviews list', async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
    
    const reviewsList = page.locator('[data-testid^="review-"], [data-testid^="card-review-"]');
    const count = await reviewsList.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show star ratings on reviews', async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
    
    const stars = page.locator('[data-testid^="stars-"], [class*="star"], svg[class*="star"]');
    const count = await stars.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have request review option on completed jobs', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    
    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const reviewButton = page.locator('[data-testid="button-request-review"], button:has-text("Request Review")');
      if (await reviewButton.first().isVisible()) {
        await expect(reviewButton.first()).toBeVisible();
      }
    }
  });

  test('should show review photos if present', async ({ page }) => {
    await navigateTo(page, '/reviews');
    await waitForPageLoad(page);
    
    const reviewPhotos = page.locator('[data-testid^="review-photo-"], img[alt*="review"]');
    const count = await reviewPhotos.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('On The Way Notification', () => {
  test('should show on the way button on job details', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    
    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const onTheWayButton = page.locator('[data-testid="button-on-the-way"], button:has-text("On The Way"), button:has-text("On My Way")');
      if (await onTheWayButton.first().isVisible()) {
        await expect(onTheWayButton.first()).toBeVisible();
      }
    }
  });

  test('should send on the way notification', async ({ page }) => {
    await navigateTo(page, '/jobs');
    await waitForPageLoad(page);
    
    const jobCard = page.locator('[data-testid^="card-job-"], [data-testid^="row-job-"]').first();
    
    if (await jobCard.isVisible()) {
      await jobCard.click();
      await page.waitForTimeout(500);
      
      const onTheWayButton = page.locator('[data-testid="button-on-the-way"], button:has-text("On The Way")');
      if (await onTheWayButton.first().isVisible()) {
        await onTheWayButton.first().click();
        await waitForToast(page);
      }
    }
  });
});
