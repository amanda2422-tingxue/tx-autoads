# AutoAds API

Backend API for AutoAds Platform - Facebook Advertising Automation System.

## Features

- **RESTful API** for managing creatives, campaigns, and performance data
- **Meta Marketing API** integration for syncing Facebook ad data
- **Automation Rules Engine** for automated campaign optimization
- **Scheduled Jobs** for data synchronization and rule execution
- **TypeScript** for type safety

## API Endpoints

### Health & Status
- `GET /health` - Health check

### Creatives (M1)
- `GET /api/creatives` - List all creatives
- `GET /api/creatives/:id` - Get creative by ID
- `POST /api/creatives` - Create new creative
- `PUT /api/creatives/:id` - Update creative
- `DELETE /api/creatives/:id` - Delete creative
- `POST /api/creatives/:id/variations` - Create creative variation

### Campaigns (M2)
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign by ID
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/duplicate` - Duplicate campaign
- `GET /api/campaigns/:campaignId/adsets` - List adsets
- `POST /api/campaigns/:campaignId/adsets` - Create adset

### Performance (M3)
- `GET /api/performance` - Get performance data
- `GET /api/performance/dashboard` - Dashboard summary
- `GET /api/performance/:id` - Get specific record

### Automation Rules (M4)
- `GET /api/rules` - List all rules
- `GET /api/rules/:id` - Get rule by ID
- `POST /api/rules` - Create new rule
- `PUT /api/rules/:id` - Update rule
- `POST /api/rules/:id/activate` - Activate rule
- `POST /api/rules/:id/deactivate` - Deactivate rule
- `DELETE /api/rules/:id` - Delete rule
- `GET /api/rules/:id/logs` - Get rule execution logs
- `POST /api/rules/:id/test` - Test rule conditions

### Meta API Integration
- `GET /api/meta/health` - Check Meta API connection
- `GET /api/meta/accounts` - Get ad accounts
- `GET /api/meta/campaigns` - Get campaigns from Meta
- `GET /api/meta/insights` - Get campaign insights
- `POST /api/meta/sync` - Sync data from Meta

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Development Server

```bash
npm run dev
```

Server will start on http://localhost:3001

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `META_APP_ID` | Meta App ID | For Meta API |
| `META_APP_SECRET` | Meta App Secret | For Meta API |
| `META_ACCESS_TOKEN` | Meta Access Token | For Meta API |
| `META_AD_ACCOUNT_ID` | Meta Ad Account ID | For Meta API |
| `JWT_SECRET` | JWT secret key | For auth |
| `ENABLE_CRON_JOBS` | Enable scheduled jobs | No (default: true) |

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `syncPerformanceData` | Every 15 minutes | Sync performance data from Meta API |
| `checkAutomationRules` | Every 5 minutes | Check and execute automation rules |
| `updateCreativeScores` | Daily at midnight | Update creative scores based on performance |

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm run test
```

## Project Structure

```
api/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/           # API routes
│   │   ├── index.ts
│   │   ├── creatives.ts
│   │   ├── campaigns.ts
│   │   ├── performance.ts
│   │   ├── rules.ts
│   │   └── meta.ts
│   ├── jobs/             # Scheduled jobs
│   │   ├── index.ts
│   │   ├── syncPerformance.ts
│   │   ├── checkRules.ts
│   │   └── updateScores.ts
│   ├── middleware/       # Express middleware
│   │   └── errorHandler.ts
│   └── utils/            # Utility functions
│       └── logger.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## Meta API Integration

The API integrates with Meta Marketing API to:

1. **Sync Campaign Data** - Fetch campaigns, adsets, and ads
2. **Sync Performance Data** - Get insights (impressions, clicks, spend, etc.)
3. **Execute Actions** - Create, update, pause campaigns (when API permissions are granted)

### Rate Limiting

Meta API has rate limits:
- Read: 200 calls/hour/user
- Write: 100 calls/hour/user

The API implements caching and batching to minimize API calls.

## Automation Rules

Rules are evaluated every 5 minutes. Supported rule types:

- **Budget Rules** - Adjust budget based on performance
- **Bid Rules** - Modify bid strategy
- **Status Rules** - Pause/activate campaigns
- **Notification Rules** - Send alerts

### Rule Conditions

Example condition structure:
```json
{
  "metric": "cpa",
  "operator": "greater_than",
  "value": 0.5,
  "timeWindow": "3d"
}
```

### Rule Actions

Example action structure:
```json
{
  "action": "pause",
  "target": "ad"
}
```

## License

Private
