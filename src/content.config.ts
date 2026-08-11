import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    period: z.string(),
    platform: z.string().default('Android'),
    role: z.string().optional(),
    stack: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
    repo: z.string().url().optional(),
    store: z.string().url().optional(),
    kind: z.enum(['product', 'library', 'side']).default('product'),
    current: z.boolean().default(false),
    order: z.number().default(99),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects };
