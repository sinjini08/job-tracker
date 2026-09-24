-- 025: the written read is gone, and so is the table behind it.
--
-- 021 added ai_reads to cache and meter a model-written read of a student's
-- search. The Insights rail no longer offers one. What it offers instead is
-- the connector: Claude or ChatGPT reading the tracker directly, which can do
-- everything the written read did and then answer the follow-up question,
-- without this app paying per paragraph.
--
-- So the endpoint, lib/ai-brief.js and lib/ai-read.js are deleted in the same
-- commit, and leaving the table would mean carrying a cache for a feature that
-- no longer exists. It held nothing: nobody had pressed the button in
-- production, so no student loses anything here.
--
-- The policy and the comment go with the table. If a written read ever comes
-- back, 021 is still in this directory and says how it was shaped.

drop table if exists public.ai_reads;
