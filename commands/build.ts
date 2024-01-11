import type { NuxtModule } from '@nuxt/schema'
import { existsSync, promises as fsp } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'build',
        description: 'Build module for distribution'
    },
    args: {
        cwd: {
            type: 'string',
            description: 'Current working directory'
        },
        rootDir: {
            type: 'positional',
            description: 'Root directory',
            required: false
        },
        outDir: {
            type: 'string'
        },
        sourcemap: {
            type: 'boolean'
        },
        stub: {
            type: 'boolean'
        }
    },
    async run(context) {
        const { build } = await import('unbuild')

        const cwd = resolve(context.args.cwd || context.args.rootDir || '.')

        const outDir = context.args.outDir || 'dist'

        await build(cwd, false, {
            declaration: true,
            sourcemap: context.args.sourcemap,
            stub: context.args.stub,
            outDir,
            entries: [
                'src/module',
                // @ts-ignore
                { input: 'src/types/', outDir: `${outDir}/types`, ext: 'd.ts' },
                { input: 'src/runtime/', outDir: `${outDir}/runtime`, ext: 'mjs' },
                { input: 'src/utils/', outDir: `${outDir}/utils`, ext: 'mjs' },
            ],
            rollup: {
                esbuild: {
                    target: 'esnext'
                },
                emitCJS: false,
                cjsBridge: true
            },
            externals: [
                '#app',
                '#vue-router',
                '@refactorjs/ofetch',
                'ofetch',
                '@nuxt/schema',
                '@nuxt/schema-edge',
                '@nuxt/kit',
                '@nuxt/kit-edge',
                'nuxt',
                'nuxt-edge',
                'nuxt3',
                'vue',
                'vue-demi'
            ],
            hooks: {
                async 'rollup:done'(ctx) {
                    // Generate CommonJS stub
                    await writeCJSStub(ctx.options.outDir)

                    // Load module meta
                    const moduleEntryPath = resolve(ctx.options.outDir, 'module.mjs')
                    const moduleFn: NuxtModule<any> = await import(
                        pathToFileURL(moduleEntryPath).toString()
                    ).then(r => r.default || r).catch((err) => {
                        console.error(err)
                        console.error('Cannot load module. Please check dist:', moduleEntryPath)
                        return null
                    })

                    if (!moduleFn) {
                        return
                    }
                    const moduleMeta = await moduleFn.getMeta!()

                    // Enhance meta using package.json
                    if (ctx.pkg) {
                        if (!moduleMeta?.name) {
                            moduleMeta.name = ctx.pkg.name
                        }
                        if (!moduleMeta?.version) {
                            moduleMeta.version = ctx.pkg.version
                        }
                    }

                    // Write meta
                    const metaFile = resolve(ctx.options.outDir, 'module.json')
                    await fsp.writeFile(metaFile, JSON.stringify(moduleMeta, null, 2), 'utf8')
                }
            }
        })
    }
})

async function writeCJSStub (distDir: string) {
  const cjsStubFile = resolve(distDir, 'module.cjs')
  if (existsSync(cjsStubFile)) {
    return
  }
  const cjsStub = `module.exports = function(...args) {
  return import('./module.mjs').then(m => m.default.call(this, ...args))
}
const _meta = module.exports.meta = require('./module.json')
module.exports.getMeta = () => Promise.resolve(_meta)
`
  await fsp.writeFile(cjsStubFile, cjsStub, 'utf8')
}
