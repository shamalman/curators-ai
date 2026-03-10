-- Email Notifications Schema
-- Run via Supabase SQL Editor

-- Add columns to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS digest_frequency TEXT DEFAULT 'weekly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Add columns to subscribers table (legacy email-only)
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS digest_frequency TEXT DEFAULT 'weekly';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Notification log (deduplication and debugging)
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  recipient_id UUID REFERENCES profiles(id),
  recipient_email TEXT NOT NULL,
  curator_id UUID REFERENCES profiles(id),
  rec_ids UUID[],
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Email action tokens (signed URLs for one-click actions from emails)
CREATE TABLE IF NOT EXISTS email_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  action TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add notification preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS new_subscriber_email_enabled BOOLEAN DEFAULT true;

-- RLS: service role only (no client access)
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tokens ENABLE ROW LEVEL SECURITY;
