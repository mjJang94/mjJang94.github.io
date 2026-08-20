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

const experience = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/experience' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // 발행일. 목록은 이 값의 내림차순으로 정렬합니다.
    date: z.coerce.date(),
    // 무엇에 대한 고민인지. 목록에서 프로젝트의 kind 자리에 표시됩니다.
    topic: z.string().default('기록'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, experience };
