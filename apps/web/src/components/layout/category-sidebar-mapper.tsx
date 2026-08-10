// lib/products/categories/category-sidebar.mapper.ts
//
// Maps the real CategoryTreeNode API response into the shape AppSidebar needs.
//
// Tree shape (3 levels):
//   level 0  → root categories   (parentId: null)   → collapsible sidebar sections
//   level 1  → sub-categories    (parentId: rootId) → sidebar sub-items
//   level 2  → leaf categories   (parentId: l1Id)   → shown on category page, NOT in sidebar
//
// URL strategy: /category/[...slug] catch-all
//   root  → /category/whole-chickens
//   l1    → /category/whole-chickens/whole-raw-chickens
//   l2    → /category/whole-chickens/whole-raw-chickens/broiler-fryer-whole-chicken

import { CategoryTreeNode } from '@/lib/products/categories/category.api';
import type { IconType } from 'react-icons';

// ── gi (game-icons) — best meat/poultry coverage ─────────────────────────────
import {
  GiChicken,
  GiChickenLeg,
  GiChickenOven,
  GiRoastChicken,
  GiMeat,
  GiMeatCleaver,
  GiMeatHook,
  GiSausage,
  GiSlicedSausage,
  GiSteak,
  GiCharcuterie,
  GiHeartOrgan,
  GiInternalOrgan,
  GiForkKnifeSpoon,
  GiManualMeatGrinder,
  GiCookingPot,
  GiHotSpices,
  GiFire,
  GiSnowflake2,
  GiFeather,
  GiCrown,
  GiLeafSwirl,
  GiBirdClaw,
  GiBirdLimb,
  GiEggClutch,
  GiRawEgg,
  GiJawbone,
  GiCrossedBones,
  GiCampfire,
  GiOrangeSlice,
  GiKnifeFork,
  GiBoneKnife,
  GiChefToque,
  GiPelvisBone,
  GiDinosaurBones,
  GiPouringPot,
  GiGlobe,
  GiDrop,
  GiDroplets,
  GiHerbsBundle,
  GiKebabSpit,
  GiDonerKebab,
  GiFoodChain,
  GiSlicedMushroom,
} from 'react-icons/gi';

// ── fa (font awesome) ─────────────────────────────────────────────────────────
import { FaDrumstickBite } from 'react-icons/fa';

// ── tb (tabler) ───────────────────────────────────────────────────────────────
import {
  TbMeat,
  TbBone,
  TbBoneFilled,
  TbFlame,
  TbSnowflake,
  TbChefHat,
  TbMoonStars,
} from 'react-icons/tb';

// ── lu (lucide via react-icons) ───────────────────────────────────────────────
import {
  LuBird,
  LuHeart,
  LuFootprints,
  LuCrown,
  LuScissors,
  LuGlobe,
  LuLeaf,
} from 'react-icons/lu';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SidebarSubItem {
  id:             string;
  title:          string;
  slug:           string;
  url:            string;
  productsCount?: number;
  /** true = this sub-item has level-2 children shown on its category page */
  hasChildren?:   boolean;
}

export interface SidebarCategory {
  id:             string;
  title:          string;
  slug:           string;
  url:            string;
  icon:           IconType;
  productsCount?: number;
  items:          SidebarSubItem[];
}


export function shortenSubItemTitle(title: string): string {
  const stripped = title.replace(/\bchickens?\s*/gi, '').trim();
  return stripped.length > 3 ? stripped : title;
}
// ─── Constants ────────────────────────────────────────────────────────────────

export const SHOP_BASE = '/category';

// ─── Icon resolver ────────────────────────────────────────────────────────────
//
// Maps the icon string stored in the DB (seeded from CategoryData.icon)
// to the best-fit react-icons component.
// Anything unrecognised falls back to GiMeat.

const ICON_LOOKUP: Record<string, IconType> = {
  // ── Whole chickens ──────────────────────────────────────────────────────────
  GiChicken:          GiChicken,
  GiRoastChicken:     GiRoastChicken,
  GiChickenOven:      GiChickenOven,

  // ── Legs & drumsticks ───────────────────────────────────────────────────────
  GiChickenLeg:       GiChickenLeg,
  FaDrumstickBite:    FaDrumstickBite,

  // ── Wings ───────────────────────────────────────────────────────────────────
  GiBirdLimb:         GiBirdLimb,
  GiBirdClaw:         GiBirdClaw,

  // ── Breast / thigh meat ─────────────────────────────────────────────────────
  TbMeat:             TbMeat,
  GiMeat:             GiMeat,
  GiMeatCleaver:      GiMeatCleaver,
  GiSteak:            GiSteak,

  // ── Bones & frames ──────────────────────────────────────────────────────────
  GiCrossedBones:     GiCrossedBones,
  GiDinosaurBones:    GiDinosaurBones,
  GiPelvisBone:       GiPelvisBone,
  GiJawbone:          GiJawbone,
  GiBoneKnife:        GiBoneKnife,
  TbBone:             TbBone,
  TbBoneFilled:       TbBoneFilled,

  // ── Organs & offal ──────────────────────────────────────────────────────────
  GiHeartOrgan:       GiHeartOrgan,
  GiInternalOrgan:    GiInternalOrgan,
  LuHeart:            LuHeart,
  LuFootprints:       LuFootprints,

  // ── Sausages / processed ────────────────────────────────────────────────────
  GiSausage:          GiSausage,
  GiSlicedSausage:    GiSlicedSausage,
  GiManualMeatGrinder: GiManualMeatGrinder,
  GiMeatHook:         GiMeatHook,

  // ── Seasoned / marinated ────────────────────────────────────────────────────
  GiHotSpices:        GiHotSpices,
  GiHerbsBundle:      GiHerbsBundle,
  GiCampfire:         GiCampfire,
  GiOrangeSlice:      GiOrangeSlice,
  GiFire:             GiFire,
  TbFlame:            TbFlame,

  // ── Cooking methods & prep ──────────────────────────────────────────────────
  GiCookingPot:       GiCookingPot,
  GiChefToque:        GiChefToque,
  TbChefHat:          TbChefHat,
  GiPouringPot:       GiPouringPot,
  GiForkKnifeSpoon:   GiForkKnifeSpoon,
  GiKnifeFork:        GiKnifeFork,
  GiKebabSpit:        GiKebabSpit,
  GiDonerKebab:       GiDonerKebab,
  LuScissors:         LuScissors,

  // ── By-products / fat / skin ────────────────────────────────────────────────
  GiCharcuterie:      GiCharcuterie,
  GiDrop:             GiDrop,
  GiDroplets:         GiDroplets,

  // ── Specialty / ethnic ──────────────────────────────────────────────────────
  GiGlobe:            GiGlobe,
  LuGlobe:            LuGlobe,
  GiFoodChain:        GiFoodChain,
  GiSlicedMushroom:   GiSlicedMushroom,

  // ── Premium / dietary ───────────────────────────────────────────────────────
  GiCrown:            GiCrown,
  LuCrown:            LuCrown,
  GiFeather:          GiFeather,
  GiLeafSwirl:        GiLeafSwirl,
  LuLeaf:             LuLeaf,
  TbMoonStars:        TbMoonStars,   // Halal
  GiSnowflake2:       GiSnowflake2,  // Frozen / air-chilled
  TbSnowflake:        TbSnowflake,

  // ── Eggs / young birds ──────────────────────────────────────────────────────
  GiEggClutch:        GiEggClutch,
  GiRawEgg:           GiRawEgg,
  LuBird:             LuBird,

  // ── Legacy lucide string aliases (kept for any old seed rows) ───────────────
  Drumstick:          GiChickenLeg,
  ChefHat:            GiChefToque,
  Flame:              GiFire,
  Soup:               GiCookingPot,
  Crown:              GiCrown,
  Bird:               LuBird,
  Egg:                GiEggClutch,
  Star:               GiCrown,
  Leaf:               GiLeafSwirl,
  Award:              GiCrown,
  Wind:               GiSnowflake2,
  Moon:               TbMoonStars,
  Bone:               TbBone,
  Scissors:           LuScissors,
  Knife:              GiKnifeFork,
  Package:            GiMeat,
  Droplet:            GiDrop,
  Heart:              LuHeart,
  Link:               GiFoodChain,
  Footprints:         LuFootprints,
  Triangle:           GiChicken,
  Fan:                GiMeatCleaver,
  Utensils:           GiForkKnifeSpoon,
  Globe:              GiGlobe,
  Sparkles:           GiHotSpices,
  Snowflake:          GiSnowflake2,
};

export function resolveIcon(iconName: string): IconType {
  return ICON_LOOKUP[iconName] ?? GiMeat;
}

// ─── URL builder ──────────────────────────────────────────────────────────────

export function buildCategoryUrl(...slugParts: string[]): string {
  return `${SHOP_BASE}/${slugParts.filter(Boolean).join('/')}`;
}

// ─── Core mapper ──────────────────────────────────────────────────────────────
//
// Processes level-0 roots only. Their level-1 children become sidebar sub-items.
// Level-2 nodes are not rendered in the sidebar — they appear on the category page.

// category-sidebar-mapper.ts

export function mapTreeToSidebarCategories(
  tree: CategoryTreeNode[],
): SidebarCategory[] {
  return tree
    .filter(node => node.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((root): SidebarCategory => {

      // ── Normalize: API returns either productsCount or productCount ──────
      const rootProductCount =
        (root as any).productCount ?? (root as any).productsCount ?? 0;

      // ── Children: flatten depth-2 nodes that have qualifying depth-3 leaves
      //    OR take direct children if they have products themselves ──────────
      const items: SidebarSubItem[] = root.children
        .filter(child => child.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((child): SidebarSubItem => ({
          id: child.id,
          title: shortenSubItemTitle(child.name),
          slug: child.slug,
          url: buildCategoryUrl(root.slug, child.slug),
          productsCount: (child as any).productCount ?? (child as any).productsCount ?? 0,
          hasChildren: child.children?.length > 0,
        }));

      return {
        id: root.id,
        title: shortenSubItemTitle(root.name),
        slug: root.slug,
        url: buildCategoryUrl(root.slug),
        icon: resolveIcon((root as any).icon as string),
        productsCount: rootProductCount,
        items,
      };
    });
}
// ─── generateStaticParams ─────────────────────────────────────────────────────
//
// Walks all 3 levels to emit every /category/[...slug] path for ISR pre-rendering.
// Use in app/category/[...slug]/page.tsx alongside `export const revalidate = 60`.

export async function generateCategoryStaticParams(): Promise<{ slug: string[] }[]> {
  const { categoryApiClient } = await import('@/lib/products/categories/category.api');
  const result = await categoryApiClient.getTree();
  const tree: CategoryTreeNode[] = result?.data ?? [];

  const paths: { slug: string[] }[] = [];

  function walk(node: CategoryTreeNode, ancestorSlugs: string[]) {
    const fullPath = [...ancestorSlugs, node.slug];
    paths.push({ slug: fullPath });
    for (const child of node.children) {
      walk(child, fullPath);
    }
  }

  for (const root of tree) walk(root, []);
  return paths;
}