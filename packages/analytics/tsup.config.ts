import { defineConfig } from 'tsup';

const sharedOptions = {
    format: ['cjs', 'esm'] as ('cjs' | 'esm')[],
    dts: {
        compilerOptions: {
            ignoreDeprecations: '6.0' as const,
        },
    },
    splitting: false,
    sourcemap: true,
    external: [
        'react',
        'react-dom',
        'next',
        'bullmq',
        'ioredis',
        '@repo/database',
    ],
    esbuildOptions(options: any) {
        options.conditions = ['module', 'import', 'require'];
    },
};

export default defineConfig([
    {
        ...sharedOptions,
        entry: {
            index: 'src/index.ts',
            'server/index': 'src/server/index.ts',
        },
    },
    {
        ...sharedOptions,
        entry: {
            'react/index': 'src/react/index.ts',
        },
        banner: {
            js: '"use client";',
        },
    },
]);