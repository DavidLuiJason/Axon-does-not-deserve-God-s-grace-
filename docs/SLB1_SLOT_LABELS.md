# SLB1 SLOT LABELS: the 70 plain phrases, for the owner to read (Director, 2026-11-07)

WHO IT IS FOR: the owner. WHAT THIS DOES: shows every phrase AXON will use when it has to ask you for a missing piece ("I need the text to count"). Source of truth is `src/decision/slotLabels.ts`; this page is a copy to skim. If a phrase reads wrong, tell the Director which tool and slot; it is one small edit.

| tool.slot | plain phrase AXON uses |
|---|---|
| text-counter.text | the text to count |
| video-frames.video | the video to take frames from |
| file-converter.file | the file to convert |
| file-converter.to | the format to convert to |
| file-converter.options | the conversion settings |
| zip-tool.files | the files to pack |
| zip-tool.archive | the archive file |
| batch-convert.files | the files to convert |
| batch-convert.to | the format to convert them to |
| file-inspector.file | the file to inspect |
| file-compare.fileA | the first file to compare |
| file-compare.fileB | the second file to compare |
| file-compare.mode | the way to compare the files |
| converter.text | the text to convert |
| converter.toFormat | the format to convert to |
| converter.from | the unit to convert from |
| converter.to | the unit to convert to |
| converter.input | the value to convert |
| find-replace.text | the text to search in |
| find-replace.pattern | the words to find |
| case-converter.text | the text to change |
| case-converter.mode | the letter case to change it to |
| text-cleaner.text | the text to clean |
| sort-lines.text | the lines to sort |
| sort-lines.mode | the way to sort them |
| text-compare.original | the original text |
| text-compare.revised | the changed text |
| text-compare.mode | the way to compare the texts |
| calculator.expression | the calculation |
| calculator.angle | degrees or radians |
| number-to-words.number | the number to write out |
| percentage-helper.mode | the kind of percentage calculation |
| percentage-helper.values | the numbers to use |
| timer.durationMs | the length of time |
| timer.operation | what to do with the timer |
| stopwatch.operation | what to do with the stopwatch |
| date-calculator.operation | the kind of date calculation |
| date-calculator.date | the date to start from |
| tally-counter.operation | what to do with the counter |
| tally-counter.name | the name of the counter |
| tally-counter.value | the number to use |
| qr-maker.text | the text to put in the code |
| qr-maker.level | how well the code survives damage |
| password-generator.length | the password length |
| password-generator.options | the kinds of characters to use |
| random-picker.operation | the kind of random choice |
| random-picker.items | the items to choose from |
| random-picker.count | how many to pick |
| encoder-decoder.mode | whether to encode or decode |
| encoder-decoder.format | the encoding to use |
| encoder-decoder.input | the text to encode or decode |
| hash-tool.input | the text to hash |
| hash-tool.algorithm | the hash method |
| my-dictionary.word | the word |
| my-dictionary.meaning | the meaning |
| my-dictionary.file | the dictionary file |
| document-reader.file | the document to read |
| summarizer.text | the text to summarize |
| summarizer.sentences | how many sentences |
| json-viewer.text | the data to show |
| code-formatter.language | the programming language |
| code-formatter.mode | how to format the code |
| code-formatter.input | the code to format |
| pattern-tester.pattern | the pattern to test |
| pattern-tester.text | the text to test it on |
| loan-calculator.yearlyRate | the yearly interest rate |
| loan-calculator.term | the length of the loan |
| split-bill.bill | the total bill |
| split-bill.tipPercent | the tip percentage |
| split-bill.people | how many people |

Proof: `tests/slotLabels.test.ts` (455 checks): all 70 required pairs labelled, no stale key, letters and spaces only, 3 to 40 characters, no code name, labels differ inside one tool. A required slot added later by a wiring card without a label is not an error: it falls back to its kind word plus the tool name (DLG1 L3).
