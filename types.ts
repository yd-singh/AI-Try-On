/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type ItemCategory = 'garment' | 'accessory';

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  category: ItemCategory;
}

export interface OutfitLayer {
  item: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}