import { toPng, toBlob } from 'html-to-image';
import { WeeklyDepartmentRoster } from '../types';

/**
 * Generates and downloads a clean, single-page image of a duty roster
 */
export async function downloadRosterAsImage(
  element: HTMLElement,
  roster: WeeklyDepartmentRoster
): Promise<boolean> {
  try {
    const dataUrl = await toPng(element, {
      quality: 0.95,
      pixelRatio: 2, // 2x DPI for crystal clear text and printouts
      backgroundColor: '#0f172a', // Solid dark slate background
      cacheBust: true,
    });

    const safeTitle = (roster.categoryName || 'Roster')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    const safeDates = (roster.startDate || 'week')
      .replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `MHC-Roster-${safeTitle}-${safeDates}.png`;

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to export roster image:', err);
    throw err;
  }
}

/**
 * Generates an image blob and invokes Web Share API or returns blob for manual sharing
 */
export async function shareRosterAsImage(
  element: HTMLElement,
  roster: WeeklyDepartmentRoster
): Promise<{ success: boolean; blob?: Blob; sharedViaNative?: boolean; error?: string }> {
  try {
    const blob = await toBlob(element, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
      cacheBust: true,
    });

    if (!blob) {
      throw new Error('Failed to generate image blob');
    }

    const safeTitle = (roster.categoryName || 'Roster')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    const filename = `MHC-Roster-${safeTitle}.png`;
    const imageFile = new File([blob], filename, { type: 'image/png' });

    // Check if Web Share API with files is supported
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [imageFile] })
    ) {
      await navigator.share({
        title: `MHC Duty Roster - ${roster.categoryName}`,
        text: `Official Duty Roster for ${roster.categoryName} (${roster.weekRangeText}) - Maduvvari Health Centre`,
        files: [imageFile],
      });
      return { success: true, blob, sharedViaNative: true };
    }

    // Fallback: return blob so calling UI can open modal with copy/download/share links
    return { success: true, blob, sharedViaNative: false };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled share dialogue
      return { success: true, sharedViaNative: true };
    }
    console.error('Error sharing roster image:', err);
    return { success: false, error: err.message || 'Share failed' };
  }
}
