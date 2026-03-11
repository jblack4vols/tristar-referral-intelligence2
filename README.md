# Tristar PT — Referral Intelligence

## Deploy to Vercel

### Option 1: Vercel Dashboard (Easiest)
1. Go to https://vercel.com/new
2. Click "Upload" and drag the project folder
3. Framework: Next.js
4. Add Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL = https://tkgygnninsbzzwlobtff.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = (see .env.example)
5. Click Deploy

### Option 2: Git
1. Push this folder to a GitHub repo
2. Connect repo to Vercel
3. Add env vars above
4. Deploy

## Supabase
- Project: Referral Intelligence
- Region: us-east-1
- URL: https://tkgygnninsbzzwlobtff.supabase.co
- Database has tables: datasets, cases, processed_kpis

## How to Use
1. Open the deployed URL
2. Upload Created Cases Report .xlsx files (from Prompt EMR)
3. Dashboard auto-populates with all KPIs, alerts, and analytics
4. Data persists in Supabase — come back anytime
5. Upload new files to add/replace years — everything recalculates
