# 09 — AI / ML

Bedrock · Textract · Transcribe

All paths under `Resources → AI / ML`.

---

## Bedrock

**Location:** `Resources → AI / ML → Bedrock`

> ⚠️ **Not implemented in this emulator.** `List foundation models` returns HTTP
> 404, so the model browser and invocation playground stay empty. The page itself
> loads without crashing. Point the instance at real AWS (with Bedrock access) to
> use it.

When backed by real AWS, the page offers: a model browser (ID, provider,
modalities) and an invocation playground (pick a model, edit the request body
JSON, **Invoke**, view streamed response).

---

## Textract

**Location:** `Resources → AI / ML → Textract`

### Detect / analyze a document
Pick an analysis type and a source:

| Field | Example value |
|-------|---------------|
| Analysis type | `Detect text` (also `Forms`, `Tables`) |
| Source — S3 | bucket `demo-bucket`, key `scan.png` |
| Source — Upload | choose a local image/PDF |

Click **Analyze** → results render as raw text / form key-value pairs / tables
depending on the type. (Upload a real document to S3 first, or use the file picker.)

The async flow (**Start analysis** → poll **job id**) is available for multi-page
documents.

---

## Transcribe

**Location:** `Resources → AI / ML → Transcribe`

### Start a transcription job
**Start Transcription Job**

| Field | Example value |
|-------|---------------|
| Job name | `demo-job` |
| Media S3 URI | `s3://demo-bucket/audio.mp3` |
| Language | `en-US` |
| Media format | `mp3` (also `mp4`, `wav`, `flac`, `ogg`, `amr`, `webm`) |
| Output bucket (optional) | `demo-bucket` |

The job list auto-refreshes while a job is `IN_PROGRESS`/`QUEUED`. For `COMPLETED`
jobs, the **View transcript** (document icon) button fetches the transcript JSON.
Row action: **Delete**.

> Upload an actual audio file to `demo-bucket` first so the media URI resolves.
