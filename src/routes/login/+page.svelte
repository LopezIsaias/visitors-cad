<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Acceso — CAD San Martín</title>
	<meta name="theme-color" content="#07211d" />
</svelte:head>

<main class="screen">
	<section class="card" aria-labelledby="titulo">
		<header class="brand">
			<span class="node" aria-hidden="true">
				<span class="node__ring"></span>
				<span class="node__dot"></span>
			</span>
			<p class="eyebrow">REGIÓN SAN MARTÍN</p>
			<p class="wordmark">CAD</p>
			<p class="sub">Centros de Acceso Digital</p>
		</header>

		<h1 id="titulo" class="titulo">Acceso al sistema</h1>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
		>
			<label class="field">
				<span class="label">Correo</span>
				<input
					name="email"
					type="email"
					inputmode="email"
					autocomplete="email"
					autocapitalize="none"
					spellcheck="false"
					required
					value={form?.email ?? ''}
					placeholder="correo@ejemplo.com"
				/>
			</label>

			<label class="field">
				<span class="label">Contraseña</span>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					placeholder="••••••••"
				/>
			</label>

			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}

			<button class="cta" type="submit" disabled={loading}>
				{loading ? 'Entrando…' : 'Entrar'}
			</button>
		</form>

		<p class="foot">Punto de acceso digital · Gobierno Regional de San Martín</p>
	</section>
</main>

<style>
	.screen {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 2.5rem);
		/* Canopy at dusk with a river-turquoise glow rising from below. */
		background:
			radial-gradient(120% 80% at 50% 115%, rgba(31, 184, 166, 0.28), transparent 60%),
			radial-gradient(90% 60% at 50% -10%, rgba(244, 178, 62, 0.1), transparent 55%),
			linear-gradient(180deg, var(--ink), var(--canopy));
	}

	.card {
		width: min(100%, 25rem);
		background: var(--paper);
		border: 1px solid var(--mist);
		border-radius: 20px;
		padding: clamp(1.5rem, 6vw, 2.25rem);
		box-shadow: 0 24px 60px -28px rgba(7, 33, 29, 0.65);
	}

	.brand {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	/* Signature: the access node — a connectivity ring that pulses. */
	.node {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 52px;
		height: 52px;
		margin-bottom: 0.85rem;
	}
	.node__ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid var(--river);
	}
	.node__ring::after {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 50%;
		border: 2px solid var(--river);
		animation: pulse 2.4s ease-out infinite;
	}
	.node__dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--canopy);
		box-shadow: 0 0 0 4px rgba(31, 184, 166, 0.18);
	}
	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.7;
		}
		100% {
			transform: scale(1.8);
			opacity: 0;
		}
	}

	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.22em;
		color: var(--river);
		font-weight: 600;
	}
	.wordmark {
		margin: 0.15rem 0 0;
		font-family: var(--display);
		font-weight: 800;
		font-size: 2.6rem;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.sub {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.titulo {
		font-family: var(--display);
		font-weight: 600;
		font-size: 1.15rem;
		margin: 0 0 1.25rem;
		text-align: center;
		color: var(--ink);
	}

	.field {
		display: block;
		margin-bottom: 1rem;
	}
	.label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--muted);
		margin-bottom: 0.4rem;
	}
	.field input {
		width: 100%;
		padding: 0.85rem 0.95rem;
		border: 1.5px solid var(--mist);
		border-radius: 12px;
		background: #fff;
		color: var(--ink);
		transition: border-color 0.15s ease;
	}
	.field input:focus {
		border-color: var(--river);
		outline: none;
	}

	.error {
		margin: 0 0 1rem;
		padding: 0.7rem 0.85rem;
		background: rgba(192, 57, 43, 0.08);
		border-left: 3px solid var(--danger);
		border-radius: 8px;
		color: var(--danger);
		font-size: 0.85rem;
	}

	.cta {
		width: 100%;
		padding: 0.95rem 1rem;
		border: none;
		border-radius: 12px;
		background: var(--canopy);
		color: var(--paper);
		font-family: var(--display);
		font-weight: 700;
		font-size: 1.02rem;
		cursor: pointer;
		transition:
			background 0.15s ease,
			transform 0.05s ease;
	}
	.cta:hover {
		background: #0a3b33;
	}
	.cta:active {
		transform: translateY(1px);
	}
	.cta:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.foot {
		margin: 1.5rem 0 0;
		text-align: center;
		font-size: 0.72rem;
		color: var(--muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.node__ring::after {
			animation: none;
		}
	}
</style>
