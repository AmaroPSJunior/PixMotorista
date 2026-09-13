/**
 * Retrieves or generates a unique persistent browser device ID
 * to uniquely identify the passenger's physical browser device.
 */
export function getOrCreateBrowserId(): string {
  if (typeof window === 'undefined') return 'SSR_DEV';
  let browserId = localStorage.getItem('pix_browser_device_id');
  if (!browserId) {
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const timeSeed = Date.now().toString(36);
    browserId = `DEV_${randomSeed}_${timeSeed}`.toUpperCase();
    localStorage.setItem('pix_browser_device_id', browserId);
  }
  return browserId;
}
