-- Lesson 1: enable pgvector and create the table embeddings will live in.
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query -> Run).

create extension if not exists vector;

create table documents (
  id bigserial primary key,
  content text,
  embedding vector(384)  -- 384 = output size of all-MiniLM-L6-v2
);
