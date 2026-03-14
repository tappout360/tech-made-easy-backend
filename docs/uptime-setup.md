# Uptime & Alert Setup Guide

## 1. UptimeRobot (Free Tier — 5-min Checks)

1. Go to [uptimerobot.com](https://uptimerobot.com) → Sign up (free)
2. Add two monitors:

| Monitor | Type | URL | Interval |
|---------|------|-----|----------|
| Backend Health | HTTP(s) | `https://tech-made-easy-backend.onrender.com/api/v1/health` | 5 min |
| Frontend | HTTP(s) | `https://technical-made-easy.vercel.app` | 5 min |

3. Set alert contacts: your email + Slack webhook (optional)
4. Expected response: `200 OK` with JSON `{ status: "ok", mongo: "connected" }`

## 2. Sentry Alert Rules

In [sentry.io](https://sentry.io) → Your Project → Alerts → Create Alert:

| Alert | Condition | Action |
|-------|-----------|--------|
| First 5xx | First occurrence of `5XX_RESPONSE` tag | Email immediately |
| Error spike | 10+ events in 1 hour | Email + Slack |
| Mongo disconnect | Message contains "MongoDB disconnected" | Email immediately |
| Rate limit spike | 20+ rate limit events in 15 min | Email |

## 3. Render Dashboard

Render provides built-in monitoring at no extra cost:
- **Logs**: Dashboard → Service → Logs (structured JSON from our middleware)
- **Metrics**: CPU, Memory, Network — visible in Render dashboard
- **Auto-restart**: Render auto-restarts crashed processes

## 4. Environment Variables Required

| Service | Variable | Where to Set |
|---------|----------|-------------|
| Backend (Render) | `SENTRY_DSN` | Render → Environment |
| Frontend (Vercel) | `VITE_SENTRY_DSN` | Vercel → Environment Variables |

Get your DSN from: Sentry → Project → Settings → Client Keys (DSN)
