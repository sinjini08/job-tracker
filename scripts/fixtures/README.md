# Fixtures

Saved copies of real job postings, one per applicant tracking system, used as
frozen inputs for the extractor.

You cannot write a deterministic test for a LinkedIn or Workday parser against
the live site. The markup changes without warning, postings get taken down, and
a run that passes on Tuesday and fails on Thursday tells you nothing about your
own code. So the page is saved once and the test runs against that.

## What uses them

| script | question it answers |
|---|---|
| `scripts/test-extract.mjs` (`npm run extract`) | does the extractor agree with the page? |
| `scripts/coverage.mjs` | how much of a row can the extension actually fill? |
| `scripts/shot-frame.mjs` | screenshots for the store listing |

Expected values in `test-extract.mjs` were read out of each page's own JSON-LD
by hand, so a pass means the extractor agrees with the posting rather than
merely with itself.

`index-page.html` is a listings page rather than a posting. It is here so
`looksLikeIndex()` has something real to say no to: the extension must refuse to
save a search results page as if it were a job.

## Why they are verbatim

A trimmed fixture tests the trimming. The whole point is that these are the
pages as served, with the wrapper markup, the duplicated JSON-LD, the tracking
parameters and the boilerplate, because that is what the extractor has to work
through in the field.

They are public postings, captured as test inputs. Nothing here is republished
as content, and none of it is used for anything but checking a parser.
