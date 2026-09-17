import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    relatedTools: z.array(z.string()).default([]),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    shortDesc: z.string(),
    icon: z.string(),
    tags: z.array(z.string()).default([]),
    inputs: z.array(z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['text', 'textarea', 'select']),
      placeholder: z.string().optional(),
      options: z.array(z.string()).optional(),
      required: z.boolean().default(true),
    })),
  }),
});

export const collections = { guides, tools };
