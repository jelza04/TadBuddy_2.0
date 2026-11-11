-- Store the detected emotion on each user message.
-- Useful later for the Insights screen (e.g. "you've sounded anxious most Mondays").
alter table messages add column if not exists emotion text;
