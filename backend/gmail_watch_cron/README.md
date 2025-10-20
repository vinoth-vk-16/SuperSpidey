# Gmail Watch Cron Job

A FastAPI service that automatically renews Gmail watches before they expire.

## Overview

This service runs as a scheduled cron job to ensure Gmail real-time notifications remain active for all users. It checks daily for Gmail watches that expire within 24 hours and automatically renews them.

## Features

- **Automatic Renewal**: Checks all user Gmail watches daily
- **Smart Timing**: Only renews watches expiring within 1 day
- **Error Handling**: Continues processing even if individual renewals fail
- **Logging**: Comprehensive logging for monitoring and debugging
- **Health Checks**: Built-in health check endpoint

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure environment variables are set (same as other services):
   - `service_key`: Firebase service account JSON

## Running the Service

### Local Development
```bash
python main.py
```
Service runs on `http://localhost:8002`

### Manual Testing
```bash
curl -X POST http://localhost:8002/renew-expired-watches
```

## API Endpoints

### POST /renew-expired-watches
Manually trigger the watch renewal check (normally called by cron).

**Response:**
```json
{
  "message": "Checked 150 users, renewed 3 watches",
  "checked_users": 150,
  "renewed_watches": 3,
  "timestamp": "2025-01-19T12:00:00.000000"
}
```

### GET /health
Health check endpoint.

## Deployment on Render

### 1. Create New Web Service
- **Runtime**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

### 2. Environment Variables
```
service_key={"type": "service_account", ...}
```

### 3. Scheduled Job Setup
Since Render doesn't have built-in cron scheduling, you have two options:

#### Option A: Use Render Cron (Recommended)
1. Create a separate "Cron Job" service in Render
2. Use a service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com)
3. Set up daily calls to: `https://your-service.onrender.com/renew-expired-watches`

#### Option B: Use Railway or Heroku
Deploy to Railway/Heroku which have built-in cron scheduling.

## Cron Schedule

The job should run **daily at 12:00 AM (midnight)** to check for expiring watches.

**Cron Expression**: `0 0 * * *` (daily at midnight)

## How It Works

1. **Fetch All Users**: Queries Firestore for all users
2. **Check Expiry**: For each user with Gmail watch enabled, checks if expiry < 24 hours
3. **Renew Watch**: Directly calls Gmail API to start a new watch
4. **Update Database**: New expiry timestamp is automatically stored
5. **Report Results**: Logs success/failure counts

## Dependencies

- **Firestore**: For user credentials, watch state, and user data (direct access)
- **Google Gmail API**: For watch renewal operations

## Monitoring

Check the service logs for:
- Number of users checked
- Number of watches renewed
- Any renewal failures

## Error Handling

- Continues processing even if individual user renewal fails
- Logs all errors for debugging
- Returns summary of operations performed

## Security

- Uses Firebase Admin SDK with service account authentication
- Communicates with other services over HTTP (localhost in development)
- No external API exposure needed (internal cron job)
