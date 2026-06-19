<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const cards = $derived([
		{ k: 'Registros totales', v: data.metricas.totalRegistros },
		{ k: 'Registros hoy', v: data.metricas.registrosHoy, accent: true },
		{ k: 'Visitantes', v: data.metricas.totalVisitantes },
		{ k: 'CADs', v: data.metricas.totalCads },
		{ k: 'Líderes', v: data.metricas.totalLideres }
	]);
</script>

<svelte:head><title>Dashboard — CAD Admin</title></svelte:head>

<header class="head">
	<div>
		<p class="eyebrow">PANEL</p>
		<h1>Dashboard</h1>
	</div>
	<p class="fecha">Hoy · {data.hoy}</p>
</header>

<section class="cards">
	{#each cards as c}
		<div class="card" class:accent={c.accent}>
			<p class="num">{c.v}</p>
			<p class="lbl">{c.k}</p>
		</div>
	{/each}
</section>

<section>
	<h2 class="seccion">Actividad por CAD</h2>
	<div class="tablewrap">
		<table>
			<thead>
				<tr><th>CAD</th><th class="r">En curso</th><th class="r">Finalizados</th><th class="r">Total</th></tr>
			</thead>
			<tbody>
				{#each data.resumen as row}
					<tr>
						<td>{row.nombre}</td>
						<td class="r">{row.en_curso}</td>
						<td class="r">{row.finalizado}</td>
						<td class="r bold">{row.total}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 1.6rem;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.66rem;
		letter-spacing: 0.18em;
		color: var(--river);
		font-weight: 700;
	}
	h1 {
		font-family: var(--display);
		margin: 0.15rem 0 0;
		font-size: 1.8rem;
	}
	.fecha {
		margin: 0;
		color: var(--muted);
		font-weight: 600;
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.9rem;
		margin-bottom: 2.2rem;
	}
	.card {
		background: #fff;
		border: 1px solid var(--mist);
		border-radius: 14px;
		padding: 1.1rem 1.2rem;
	}
	.card.accent {
		background: var(--canopy);
		border-color: var(--canopy);
		color: var(--paper);
	}
	.num {
		font-family: var(--display);
		font-weight: 800;
		font-size: 2.1rem;
		margin: 0;
		line-height: 1;
	}
	.lbl {
		margin: 0.4rem 0 0;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.card.accent .lbl {
		color: rgba(243, 246, 244, 0.85);
	}
	.seccion {
		font-family: var(--display);
		font-size: 1.15rem;
		margin: 0 0 0.9rem;
	}
	.tablewrap {
		overflow-x: auto;
		border: 1px solid var(--mist);
		border-radius: 12px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		padding: 0.65rem 0.9rem;
		text-align: left;
		border-bottom: 1px solid var(--mist);
	}
	thead th {
		background: var(--paper);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	.r {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.bold {
		font-weight: 700;
	}
</style>
