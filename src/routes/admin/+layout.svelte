<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();

	const nav = [
		{ href: '/admin', label: 'Dashboard', exact: true },
		{ href: '/admin/cads', label: 'CADs', exact: false },
		{ href: '/admin/lideres', label: 'Líderes', exact: false },
		{ href: '/admin/profesiones', label: 'Profesiones', exact: false },
		{ href: '/admin/visitantes', label: 'Visitantes', exact: false },
		{ href: '/admin/registros', label: 'Registros', exact: false }
	];

	const activo = (href: string, exact: boolean) =>
		exact ? $page.url.pathname === href : $page.url.pathname.startsWith(href);
</script>

<div class="shell">
	<aside class="side">
		<div class="brand">
			<span class="node" aria-hidden="true"></span>
			<div>
				<p class="eyebrow">SAN MARTÍN</p>
				<p class="word">CAD · Admin</p>
			</div>
		</div>

		<nav>
			{#each nav as item}
				<a href={item.href} class="link" class:on={activo(item.href, item.exact)}>{item.label}</a>
			{/each}
		</nav>

		<form method="POST" action="/admin?/logout" class="salir">
			<p class="who">{data.nombre ?? 'Superadmin'}</p>
			<button type="submit">Cerrar sesión</button>
		</form>
	</aside>

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 248px 1fr;
		min-height: 100svh;
	}
	.side {
		background: linear-gradient(180deg, var(--ink), var(--canopy));
		color: var(--paper);
		padding: 1.4rem 1.1rem;
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 0;
		height: 100svh;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 2rem;
	}
	.node {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 2px solid var(--river);
		display: grid;
		place-items: center;
		flex: none;
	}
	.node::after {
		content: '';
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--river);
	}
	.eyebrow {
		margin: 0;
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		color: var(--river);
		font-weight: 600;
	}
	.word {
		margin: 0.1rem 0 0;
		font-family: var(--display);
		font-weight: 800;
		font-size: 1.15rem;
	}
	nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}
	.link {
		text-decoration: none;
		color: rgba(243, 246, 244, 0.82);
		padding: 0.65rem 0.8rem;
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.95rem;
		transition: background 0.12s ease;
	}
	.link:hover {
		background: rgba(255, 255, 255, 0.08);
	}
	.link.on {
		background: var(--river);
		color: var(--ink);
	}
	.salir {
		border-top: 1px solid rgba(255, 255, 255, 0.14);
		padding-top: 1rem;
	}
	.who {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		opacity: 0.75;
	}
	.salir button {
		width: 100%;
		background: rgba(255, 255, 255, 0.1);
		color: var(--paper);
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: 10px;
		padding: 0.55rem;
		cursor: pointer;
	}
	.content {
		padding: 2rem 2.2rem;
		background: #fbfcfb;
		min-width: 0;
	}

	@media (max-width: 720px) {
		.shell {
			grid-template-columns: 1fr;
		}
		.side {
			position: static;
			height: auto;
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
		}
		.brand {
			margin: 0 auto 0 0;
		}
		nav {
			flex-direction: row;
			flex-wrap: wrap;
			flex: none;
		}
		.salir {
			border: none;
			padding: 0;
		}
		.who {
			display: none;
		}
		.content {
			padding: 1.2rem;
		}
	}
</style>
