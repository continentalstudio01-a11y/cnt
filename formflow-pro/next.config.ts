import type {NextConfig} from 'next';import path from 'node:path';
const config:NextConfig={webpack(config,context){if(context.webpack?.NormalModuleReplacementPlugin)config.plugins.push(new context.webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,path.resolve(process.cwd(),'lib/platform-vercel.ts')));return config},poweredByHeader:false};export default config;
