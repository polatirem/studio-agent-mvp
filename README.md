# Studio Agent MVP

## What is this project?

This is a small Node.js studio-agent that turns `knowledge-base.md` into reusable learning and decision artifacts.

The project started as a JSON artifact generator, but it now also creates a presentation-ready HTML report at:

```bash
outputs/report.html
```

## What problem does it solve?

Knowledge notes are useful, but they are not always easy to present, teach from, or make decisions with. This MVP takes one knowledge base and compiles it into several structured outputs:

- a professional executive summary
- a decision-focused insight brief
- a comparison matrix
- an FAQ
- a quiz
- a guided worksheet
- a readable HTML report

The goal is to make the same source knowledge usable in different situations without rewriting everything by hand.

## How it works

The compiler follows a simple pipeline:

1. Read `knowledge-base.md`
2. Extract a lightweight fact layer:
   - variables
   - measurements
   - comparisons
   - evidence
   - visual suggestions
3. Generate structured JSON artifacts
4. Validate them with schema and semantic lint rules
5. Render the artifacts into `outputs/report.html`

The system is rule-based and intentionally lightweight. It does not use a database, frontend framework, or heavy dependencies.

## Artifact types explained

`executive-summary.json` gives the main findings, evidence, implications, and recommended actions.

`insight-brief.json` turns the analysis into decision support. It explains why each claim matters and links claims to evidence.

`comparison-matrix.json` compares detected relationships, key metrics, interpretations, and source sections.

`faq.json` answers natural questions a reader might ask.

`quiz.json` checks understanding with recall, interpretation, comparison, and method-selection questions.

`worksheet.json` gives guided learning tasks with an answer key.

`report.html` combines the artifacts into a clean, readable report for demo or review.

## How to run

```bash
npm start
```

After the run, the compiler writes JSON files and creates:

```bash
outputs/report.html
```

On a normal desktop session, the report will try to open automatically in the browser. If you want to skip auto-open:

```bash
NO_OPEN=1 npm start
```

On Windows PowerShell:

```powershell
$env:NO_OPEN="1"; npm start
```

## Interactive Studio

Run the local studio UI with:

```bash
npm run studio
```

Then open:

```bash
http://localhost:4317
```

The studio lets you paste a knowledge base, choose an audience, choose an artifact type, and generate a grounded preview. It uses the same fact extraction and artifact pipeline as the CLI compiler. The browser UI does not generate directly from raw text; it calls the local Node pipeline so outputs stay source-grounded and traceable.

Studio artifact options include executive summary, insight brief, FAQ, quiz, worksheet, comparison matrix, slide deck, summary notes, teaching outline, and decision card.

The studio also shows confidence indicators on supported claims. Slide deck output includes a presentation mode with next/previous controls, keyboard navigation, and a dark/light slide view.

## Example output explanation

For the current statistical knowledge base, the report focuses on the Time 1 vs Time 2 comparison. It highlights the median decrease, statistical significance, effect size, confidence interval, and recommended ways to communicate the result.

The JSON artifacts are still kept in `outputs/` so the system remains machine-readable, but `report.html` is the main human-readable demo output.
