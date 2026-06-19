import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Despliegue en Vercel (Node serverless). Variables de entorno se cargan en
			// Vercel → Settings → Environment Variables (las 3 de Supabase).
			adapter: adapter()
		})
	]
});
