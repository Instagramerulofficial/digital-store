-- =============================================================
-- Digital Store - Demo seed data
-- Run this AFTER schema.sql and AFTER you've uploaded at least
-- one placeholder file to the `products` storage bucket (see below).
--
-- Quick path to make these work:
--   1. In Storage -> products, create a folder `files/` and upload a
--      small placeholder file (any zip/pdf). Rename it so the paths below
--      match, OR edit the `file_path` / `file_name` values to your uploads.
--   2. Run this SQL in the Supabase SQL Editor.
--
-- All prices are in cents (1900 = $19.00).
-- =============================================================

insert into public.products
  (slug, title, description, price_cents, currency, image_url,
   file_path, file_name, file_size_bytes, category, is_published)
values
  (
    'nebula-ui-kit',
    'Nebula UI Kit',
    E'A premium Figma UI kit with 120+ components, light/dark themes, and a full design-system variables setup.\n\nIncludes:\n- 120+ components\n- 30 prebuilt screens\n- Typography + color tokens\n- Figma variables for instant theming',
    2900, 'usd',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
    'files/nebula-ui-kit.zip', 'nebula-ui-kit.zip', 52428800,
    'UI Kits', true
  ),
  (
    'saas-landing-template',
    'SaaS Landing Template',
    E'Modern, conversion-focused Next.js landing template built with Tailwind.\n\n- Next.js 15 + TypeScript\n- 8 section blocks (hero, features, pricing, FAQ, CTA...)\n- Dark mode out of the box\n- 100/100 Lighthouse',
    4900, 'usd',
    'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1200&q=80',
    'files/saas-landing-template.zip', 'saas-landing-template.zip', 8388608,
    'Templates', true
  ),
  (
    'ultimate-ebook-bundle',
    'The Ultimate Indie Hacker Ebook Bundle',
    E'Three ebooks (420 pages total) on shipping, marketing and monetizing solo products.\n\n- PDF + EPUB formats\n- Free updates for 1 year\n- Real revenue case studies',
    1900, 'usd',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80',
    'files/indie-hacker-bundle.zip', 'indie-hacker-bundle.zip', 12582912,
    'Ebooks', true
  ),
  (
    'notion-productivity-os',
    'Notion Productivity OS',
    E'A complete Notion workspace template for founders: tasks, goals, notes, CRM and weekly review dashboards.',
    2400, 'usd',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80',
    'files/notion-productivity-os.zip', 'notion-productivity-os.zip', 2097152,
    'Templates', true
  ),
  (
    'lofi-sample-pack-vol1',
    'Lofi Sample Pack Vol. 1',
    E'80 original lofi samples - drums, melodic loops, textures and one-shots. 100% royalty-free.',
    1500, 'usd',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&q=80',
    'files/lofi-sample-pack-vol1.zip', 'lofi-sample-pack-vol1.zip', 104857600,
    'Audio', true
  ),
  (
    'icon-pack-minimal-500',
    'Minimal Icon Pack 500',
    E'500 hand-crafted SVG icons in a minimal, 1.5px-stroke style. Works with any framework.',
    900, 'usd',
    'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1200&q=80',
    'files/minimal-icon-pack-500.zip', 'minimal-icon-pack-500.zip', 3145728,
    'UI Kits', true
  )
on conflict (slug) do nothing;
