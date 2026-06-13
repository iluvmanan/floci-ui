# Feature 06: Monitoring & Logs

## Overview
Real-time CloudWatch Logs viewer with live tail (SSE), log group/stream navigation, and CloudWatch Metrics charts.

## Acceptance Criteria
- [ ] Log groups tree on left; log viewer on right
- [ ] Live tail mode: SSE stream auto-reconnects on disconnect
- [ ] Filter by keyword, time range, log level (ERROR/WARN/INFO/DEBUG)
- [ ] Virtualized log list for performance (1000+ log lines without janking)
- [ ] Color-coded log levels
- [ ] Relative timestamps ("2 min ago") with absolute on hover
- [ ] Download logs as `.txt` file
- [ ] CloudWatch Metrics: namespace → metric → dimensions → time range → recharts line chart
- [ ] Multi-metric overlay on same chart

## API Contracts

### Logs
```
GET  /api/instances/{id}/monitoring/log-groups
     → [{ name, retention_days, stored_bytes }]

GET  /api/instances/{id}/monitoring/log-groups/{group}/streams
     → [{ name, first_event_time, last_event_time, stored_bytes }]

GET  /api/instances/{id}/monitoring/log-groups/{group}/events
     ?stream=&start=<epoch_ms>&end=<epoch_ms>&filter=&limit=500&next_token=
     → { events: [{ timestamp, message, stream }], next_token }

GET  /api/instances/{id}/monitoring/log-groups/{group}/tail   (SSE)
     ?stream=&filter=&last_token=
     → text/event-stream, each event: { id: token, data: { timestamp, message, stream } }
```

### Metrics
```
GET  /api/instances/{id}/monitoring/metrics/namespaces
     → ["AWS/Lambda", "AWS/SQS", ...]

GET  /api/instances/{id}/monitoring/metrics
     ?namespace=AWS/Lambda&metric_name=Invocations&dimension_name=FunctionName&dimension_value=my-fn
     → [{ name, namespace, dimensions }]

GET  /api/instances/{id}/monitoring/metrics/data
     ?namespace=AWS/Lambda&metric_name=Invocations&start=<epoch>&end=<epoch>&period=60
     &statistic=Sum&dimension_name=&dimension_value=
     → { timestamps: [], values: [], unit }
```

## SSE Implementation
```python
@router.get("/{id}/monitoring/log-groups/{group}/tail")
async def tail_logs(id: str, group: str, stream: str = None, filter: str = None):
    async def event_generator():
        next_token = None
        while True:
            events = cloudwatch.filter_log_events(
                logGroupName=group,
                logStreamNames=[stream] if stream else None,
                filterPattern=filter or "",
                nextToken=next_token,
            )
            for e in events.get("events", []):
                yield f"id: {events['nextToken']}\ndata: {json.dumps(e)}\n\n"
            next_token = events.get("nextToken")
            await asyncio.sleep(2)
    return EventSourceResponse(event_generator())
```

## Frontend Log Viewer
```
┌─────────────────────────────────────────────────────────────────┐
│ [Search logs...]  [Time Range ▼]  [Level ▼]  [Live Tail ●]      │
├─────────────────────────────────────────────────────────────────┤
│ ● ERROR  10:32:15  /aws/lambda/my-fn  [stream-1]               │
│   RuntimeError: Connection refused                              │
│                                                                 │
│ ● INFO   10:32:16  /aws/lambda/my-fn  [stream-1]               │
│   START RequestId: abc123 ...                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Metrics Charts
- Recharts LineChart with responsive container
- Multiple metrics as multiple `<Line>` components with different colors
- Custom tooltip: metric name, value, unit, timestamp
- Time range presets: 1h, 3h, 12h, 24h, 7d + custom date picker
- Auto-refresh every 60s when viewing recent data
