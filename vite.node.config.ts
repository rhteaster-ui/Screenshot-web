import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:'frontend',publicDir:'../public',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},build:{outDir:'../dist-node',emptyOutDir:true}});
