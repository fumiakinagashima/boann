// Message for an app import job sent to the Queue.
// The plan and body are not carried in the message; they are read from import_jobs (the draft).
//  - design: read the uploaded content and have the AI design a plan
//  - apply : deterministically apply the drafted plan to create the app
export type ImportJobMessage = {
	type: 'design' | 'apply';
	jobId: string;
};
