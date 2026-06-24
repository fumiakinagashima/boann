<script lang="ts">
	import WorkflowEditor from '$lib/components/database/WorkflowEditor.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.workflow.name} — ワークフロー編集</title></svelte:head>

<WorkflowEditor
	id={data.workflow.id}
	initialName={data.workflow.name}
	initialTriggerHour={data.workflow.triggerHour}
	initialTriggerMinute={data.workflow.triggerMinute}
	initialSteps={data.workflow.steps}
	initialEnabled={data.workflow.enabled}
	runs={data.runs}
	entityTypes={data.entityTypes}
	slackIntegrations={data.slackIntegrations}
/>
