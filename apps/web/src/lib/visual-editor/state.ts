/**
 * Visual Editor State Management
 *
 * Global state atoms for the visual editing feature using Jotai.
 * These atoms track whether visual editing mode is active and which
 * element is currently selected.
 */

import { atom } from 'jotai';
import { ElementInfo } from './types';

/**
 * Whether visual editing mode is currently enabled
 *
 * When true:
 * - The preview iframe has visual editor overlays active
 * - User can hover and click elements to select them
 * - Visual editing panel may be shown
 *
 * When false:
 * - Normal preview interaction
 * - No element selection or highlighting
 */
export const visualEditingModeAtom = atom<boolean>(false);

/**
 * Currently selected element in visual editing mode
 *
 * Set to ElementInfo when user clicks an element in the preview
 * Set to null when:
 * - Visual editing mode is disabled
 * - User closes the editing panel
 * - User selects a different element
 */
export const selectedElementAtom = atom<ElementInfo | null>(null);
