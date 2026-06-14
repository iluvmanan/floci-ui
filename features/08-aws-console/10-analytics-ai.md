# 08-10: Athena, Glue, Data Firehose, OpenSearch, Bedrock, Textract, Transcribe

---

## Athena

**boto3 service:** `"athena"`
**Backend file:** `backend/app/routers/resources/athena.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/athena/page.tsx`
**Nav entry:** `{ label: "Athena", href: "athena", icon: Search }` under Analytics group

### Backend Tasks
- [ ] `GET /workgroups` — `list_work_groups` → `[{ name, state, description, creation_time }]`
- [ ] `POST /workgroups` — `create_work_group` body: `{ name, description?, configuration: { result_configuration: { output_location } } }` → 200
- [ ] `DELETE /workgroups/{name}` — `delete_work_group(RecursiveDeleteOption=True)`
- [ ] `GET /databases` — `list_databases(CatalogName=AwsDataCatalog)` → `[{ name, description, parameters }]`
- [ ] `POST /queries` — `start_query_execution` body: `{ query_string, workgroup?: primary, query_execution_context?: { database, catalog }, result_configuration?: { output_location } }` → `{ query_execution_id }`
- [ ] `GET /queries/{id}` — `get_query_execution` → `{ status: { state, state_change_reason, submission_date_time, completion_date_time }, statistics: { data_scanned_in_bytes, engine_execution_time_in_millis } }`
- [ ] `GET /queries/{id}/results` — `get_query_results` → `{ columns: [{name,type}], rows: [[values]] }`
- [ ] `GET /query-history` — `list_query_executions(WorkGroup)` → query IDs → batch `get_query_execution` → list with status + query preview
- [ ] `POST /queries/{id}/cancel` — `stop_query_execution`

### Frontend Tasks
- [ ] Create `athena/page.tsx` with split layout:
  - [ ] Left sidebar: Databases list (expandable to show tables) + Workgroup selector + Query History tab
  - [ ] Main area: SQL query editor (textarea, monospace) + Run button + status bar (runtime, bytes scanned)
- [ ] Query execution:
  - [ ] "Run Query" → start_query_execution → poll GET /queries/{id} every 1s until SUCCEEDED/FAILED
  - [ ] Show results in paginated table below editor when SUCCEEDED
  - [ ] Show error reason when FAILED
- [ ] Workgroups tab: list + create dialog (name, S3 output location) + delete
- [ ] Query History: list of past queries (preview of SQL, status badge, data scanned, date) → click to load SQL into editor
- [ ] Cancel running query button (shown during RUNNING state)
- [ ] Add API methods: `listAthenaWorkgroups`, `createAthenaWorkgroup`, `deleteAthenaWorkgroup`, `listAthenaDatabases`, `runAthenaQuery`, `getQueryExecution`, `getQueryResults`, `listQueryHistory`, `cancelQuery`

---

## Glue

**boto3 service:** `"glue"`
**Backend file:** `backend/app/routers/resources/glue.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/glue/page.tsx`
**Nav entry:** `{ label: "Glue", href: "glue", icon: Combine }` under Analytics group

### Backend Tasks
- [ ] `GET /databases` — `get_databases(CatalogId?)` → `[{ name, description, location_uri, create_time, parameters }]`
- [ ] `POST /databases` — `create_database` body: `{ name, description?, location_uri? }` → 200
- [ ] `DELETE /databases/{name}` — `delete_database`
- [ ] `GET /databases/{name}/tables` — `get_tables(DatabaseName)` → `[{ name, description, table_type, create_time, update_time, storage_descriptor: { location, columns } }]`
- [ ] `GET /crawlers` — `list_crawlers` + `get_crawlers` → `[{ name, role, targets, database_name, schedule, state, last_run }]`
- [ ] `POST /crawlers` — `create_crawler` body: `{ name, role, database_name, targets: { s3_targets?: [{path}], jdbc_targets?: [] }, schedule?, configuration? }` → 200
- [ ] `DELETE /crawlers/{name}` — `delete_crawler`
- [ ] `POST /crawlers/{name}/start` — `start_crawler`
- [ ] `POST /crawlers/{name}/stop` — `stop_crawler`
- [ ] `GET /jobs` — `list_jobs` + `get_jobs` → `[{ name, description, role, command: { name, script_location }, default_arguments, created_on, last_modified_on }]`
- [ ] `POST /jobs` — `create_job` body: `{ name, role, command: { name: glueetl|pythonshell, script_location }, glue_version?, number_of_workers?, worker_type? }` → `{ name }`
- [ ] `DELETE /jobs/{name}` — `delete_job`
- [ ] `POST /jobs/{name}/start` — `start_job_run` body: `{ arguments?: {} }` → `{ job_run_id }`
- [ ] `GET /jobs/{name}/runs` — `get_job_runs` → `[{ id, job_name, run_id, attempt, triggered_by, started_on, last_modified_on, completed_on, job_run_state, error_message, execution_time }]`

### Frontend Tasks
- [ ] Create `glue/page.tsx` with tabs: Data Catalog | Crawlers | Jobs
- [ ] Data Catalog tab: databases list → click to expand tables → table schema viewer (columns, location)
- [ ] Crawlers tab: table (name, database, schedule, state badge, last run) + "Create Crawler" dialog (name, role, S3 paths, database) + start/stop/delete buttons
- [ ] Jobs tab: table (name, type, role, created) + "Create Job" dialog (name, role, script location, worker type, worker count) + "Run Job" button → job runs sub-table (run ID, status badge, started, duration, error) + delete job
- [ ] Add API methods: `listGlueDatabases`, `createGlueDatabase`, `deleteGlueDatabase`, `listGlueTables`, `listGlueCrawlers`, `createGlueCrawler`, `deleteGlueCrawler`, `startGlueCrawler`, `stopGlueCrawler`, `listGlueJobs`, `createGlueJob`, `deleteGlueJob`, `startGlueJob`, `getJobRuns`

---

## Data Firehose

**boto3 service:** `"firehose"`
**Backend file:** `backend/app/routers/resources/firehose.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/firehose/page.tsx`
**Nav entry:** `{ label: "Data Firehose", href: "firehose", icon: Flame }` under Messaging group

### Backend Tasks
- [ ] `GET /delivery-streams` — `list_delivery_streams` + `describe_delivery_stream` (batch) → `[{ delivery_stream_name, delivery_stream_arn, delivery_stream_status, delivery_stream_type, s3_destination?, extended_s3_destination?, elasticsearch_destination?, http_endpoint_destination?, create_timestamp }]`
- [ ] `POST /delivery-streams` — `create_delivery_stream` body: `{ delivery_stream_name, delivery_stream_type?: DirectPut|KinesisStreamAsSource, destination: s3|extended_s3|elasticsearch|http_endpoint, s3_config?: { role_arn, bucket_arn, prefix?, buffering_hints }, extended_s3_config?, elasticsearch_config?, http_endpoint_config? }` → `{ delivery_stream_arn }`
- [ ] `DELETE /delivery-streams/{name}` — `delete_delivery_stream`
- [ ] `POST /delivery-streams/{name}/records` — `put_record` body: `{ data_base64: string }` → `{ record_id }`
- [ ] `POST /delivery-streams/{name}/records/batch` — `put_record_batch` body: `{ records: [{ data_base64 }] }` → `{ failed_put_count, request_responses }`

### Frontend Tasks
- [ ] Create `firehose/page.tsx`: delivery stream list + test panel
- [ ] Table: Name, Type badge, Status badge, Destination type, Created
- [ ] "Create Delivery Stream" wizard:
  - [ ] Source: Direct PUT or Kinesis Stream
  - [ ] Destination: S3 / Amazon OpenSearch / HTTP Endpoint (destination-specific config form)
  - [ ] S3 config: bucket ARN, prefix, buffering hints (size MB + interval seconds)
- [ ] Click stream → "Send Test Record" panel: data textarea + "Put Record" button → show record ID
- [ ] "Delete Stream" button
- [ ] Add API methods: `listFirehoseStreams`, `createFirehoseStream`, `deleteFirehoseStream`, `firehosePutRecord`, `firehosePutRecordBatch`

---

## OpenSearch

**boto3 service:** `"opensearch"`
**Backend file:** `backend/app/routers/resources/opensearch.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/opensearch/page.tsx`
**Nav entry:** `{ label: "OpenSearch", href: "opensearch", icon: SearchCode }` under Analytics group

### Backend Tasks
- [ ] `GET /domains` — `list_domain_names` → domain names → `describe_domains` → `[{ domain_name, arn, created, deleted, endpoint, processing, upgrade_processing, engine_version, cluster_config, ebs_options, access_policies }]`
- [ ] `POST /domains` — `create_domain` body: `{ domain_name, engine_version?: OpenSearch_2.11, cluster_config: { instance_type?, instance_count?, dedicated_master_enabled? }, ebs_options: { ebs_enabled: true, volume_type, volume_size }, access_policies? }` → `{ domain_status: { arn, created, endpoint } }`
- [ ] `DELETE /domains/{name}` — `delete_domain`
- [ ] `GET /domains/{name}` — `describe_domain` → full domain config + status

### Frontend Tasks
- [ ] Create `opensearch/page.tsx`: domain list
- [ ] Table: Name, Engine Version, Status (badge: Active=green/Creating=yellow/Deleting=red), Endpoint (with copy + open link), Instance Type, Nodes
- [ ] "Create Domain" dialog: domain name, engine version dropdown, instance type, instance count, EBS size (GB)
- [ ] Click domain → detail panel: endpoint, cluster config, access policies JSON viewer, processing status
- [ ] "Open Dashboards" button → open endpoint in new tab
- [ ] Delete domain button (with confirmation)
- [ ] Add API methods: `listOpenSearchDomains`, `createOpenSearchDomain`, `deleteOpenSearchDomain`, `describeOpenSearchDomain`

---

## Bedrock (Runtime)

**boto3 services:** `"bedrock"` (list models) + `"bedrock-runtime"` (invoke)
**Backend file:** `backend/app/routers/resources/bedrock.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/bedrock/page.tsx`
**Nav entry:** `{ label: "Bedrock", href: "bedrock", icon: Brain }` under AI/ML group

### Backend Tasks
- [ ] `GET /models` — `list_foundation_models` (bedrock client) → `[{ model_id, model_name, provider_name, input_modalities, output_modalities, response_streaming_supported, customizations_supported }]`
- [ ] `POST /models/{model_id}/invoke` — `invoke_model` body: `{ body: {} (model-specific JSON), content_type?: application/json }` → `{ body: {} (response JSON), content_type }`
- [ ] `POST /models/{model_id}/invoke-stream` — `invoke_model_with_response_stream` body: same → chunks via SSE → collect and return assembled response

### Frontend Tasks
- [ ] Create `bedrock/page.tsx` with model playground
- [ ] Left panel: model browser (grouped by provider: Anthropic/AI21/Amazon/Cohere/Meta/Mistral) with filter input
- [ ] Right panel: invocation playground for selected model:
  - [ ] Model-aware request builder: for Claude models show messages array UI; for others show raw JSON body editor
  - [ ] "Invoke" button (non-streaming) + "Stream" button (streaming)
  - [ ] Response display: JSON formatted output + latency + token counts (if available)
  - [ ] Streaming response: text appended character by character in real-time
  - [ ] Model info sidebar: modalities badges, streaming support, customization support
- [ ] Add API methods: `listBedrockModels`, `invokeBedrockModel`, `invokeBedrockModelStream`

---

## Textract

**boto3 service:** `"textract"`
**Backend file:** `backend/app/routers/resources/textract.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/textract/page.tsx`
**Nav entry:** `{ label: "Textract", href: "textract", icon: FileSearch }` under AI/ML group

### Backend Tasks
- [ ] `POST /documents/text` — `detect_document_text` body: `{ s3_bucket?: string, s3_key?: string, bytes_base64?: string }` → `{ blocks: [{ block_type, text, confidence, geometry }], document_metadata }`
- [ ] `POST /documents/forms` — `analyze_document(FeatureTypes=["FORMS"])` body: same → `{ blocks, key_value_sets: [{key, value, confidence}] }`
- [ ] `POST /documents/tables` — `analyze_document(FeatureTypes=["TABLES"])` body: same → `{ blocks, tables: [[cell_values]] }`
- [ ] `POST /documents/queries` — `analyze_document(FeatureTypes=["QUERIES"])` body + `{ queries: [{text, alias}] }` → `{ query_results: [{alias, answer, confidence}] }`
- [ ] `POST /jobs/start` — `start_document_analysis` body: `{ s3_bucket, s3_key, feature_types[], notification_channel? }` → `{ job_id }`
- [ ] `GET /jobs/{job_id}` — `get_document_analysis` → `{ job_status: IN_PROGRESS|SUCCEEDED|FAILED, blocks?, document_metadata }`

### Frontend Tasks
- [ ] Create `textract/page.tsx`:
  - [ ] Input section: radio (Upload file / S3 location), file picker or S3 bucket+key inputs
  - [ ] Analysis type tabs: Text Detection | Forms | Tables | Queries
  - [ ] "Analyze" button → call appropriate endpoint → display results
  - [ ] Text Detection results: extracted text paragraphs
  - [ ] Forms results: key-value table (Key | Value | Confidence %)
  - [ ] Tables results: rendered HTML table with extracted data
  - [ ] Queries: enter questions about the document → show answers with confidence
  - [ ] Document preview panel: if file uploaded, show image
- [ ] Add API methods: `textractDetectText`, `textractAnalyzeForms`, `textractAnalyzeTables`, `textractAnalyzeQueries`, `textractStartJob`, `textractGetJob`

---

## Transcribe

**boto3 service:** `"transcribe"`
**Backend file:** `backend/app/routers/resources/transcribe.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/transcribe/page.tsx`
**Nav entry:** `{ label: "Transcribe", href: "transcribe", icon: Mic }` under AI/ML group

### Backend Tasks
- [ ] `POST /jobs` — `start_transcription_job` body: `{ transcription_job_name, media_uri (s3://), language_code: en-US|es-US|fr-FR|..., media_format?: mp3|mp4|wav|flac, output_bucket_name?, settings? }` → `{ transcription_job_name, transcription_job_status }`
- [ ] `GET /jobs` — `list_transcription_jobs(Status?)` → `[{ transcription_job_name, creation_time, start_time, completion_time, language_code, transcription_job_status, failure_reason? }]`
- [ ] `GET /jobs/{name}` — `get_transcription_job` → `{ transcription_job_name, transcript_file_uri?, media_uri, language_code, transcription_job_status, creation_time, completion_time, failure_reason? }`
- [ ] `DELETE /jobs/{name}` — `delete_transcription_job`
- [ ] `GET /jobs/{name}/transcript` — fetch transcript JSON from `transcript_file_uri` S3 URL → return `{ transcript: string, items: [] }`

### Frontend Tasks
- [ ] Create `transcribe/page.tsx`:
  - [ ] "Start Transcription" dialog: job name, S3 media URI, language code dropdown (30+ options), media format, output S3 bucket
  - [ ] Job list table: Name, Language, Status badge (Completed=green/InProgress=blue/Failed=red), Created, Completed
  - [ ] Auto-refresh job list every 10s when any job is IN_PROGRESS
  - [ ] "View Transcript" button per completed job → fetch transcript text and show in scrollable modal (paragraph form)
  - [ ] "Delete" button per job
- [ ] Add API methods: `startTranscriptionJob`, `listTranscriptionJobs`, `getTranscriptionJob`, `deleteTranscriptionJob`, `getTranscript`
