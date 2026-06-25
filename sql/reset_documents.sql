-- Wipes the documents table so lesson2_ingest.py can be re-run cleanly
-- (e.g. after fixing the dedup logic). Run in the Supabase SQL Editor.

truncate table documents;
