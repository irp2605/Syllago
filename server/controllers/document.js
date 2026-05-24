const chrono = require('chrono-node');
const EXAM_KEYWORDS = ['exam', 'midterm', 'final'];
const { PDFParse } = require('pdf-parse');

const extractTextFromPdf = async (buffer) => {
    const magic = buffer.slice(0, 4).toString();
    if (magic !== '%PDF') {
        throw new Error('Invalid PDF file.');
    }

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    return result.text;
};

const deduplicateExamDates = (examDates) => {
    const byDay = new Map();

    examDates.forEach(({ result, name, date, time }) => {
        const key = date.toISOString().slice(0, 10);

        if (!byDay.has(key)) {
            byDay.set(key, { result, name, date, time });
        } else {
            const current = byDay.get(key);
            const incomingHasTime = result.start.isCertain('hour');
            const currentHasTime = current.result.start.isCertain('hour');

            if (incomingHasTime && !currentHasTime) {
                byDay.set(key, { result, name, date, time });
            }
        }
    });

    return Array.from(byDay.values()).map(({ name, date, time }) => ({ name, date, time }));
};

exports.parseDates = async (req, res) => {
    try {
        const texts = await Promise.all(
            req.files.map(file => extractTextFromPdf(file.buffer))
        );

        const syllabi = texts.map((text, i) => {
            const results = chrono.parse(text);

            const examDates = results
                .filter(result => {
                    if (!result.start.isCertain('day') || !result.start.isCertain('month')) {
                        return false;
                    }

                    const start = Math.max(0, result.index - 40);
                    const end = result.index + result.text.length + 40;
                    const context = text.slice(start, end).toLowerCase();
                    return EXAM_KEYWORDS.some(kw => context.includes(kw));
                })
                .map(result => ({
                    result,
                    name: result.text,
                    time: result.start.isCertain('hour')
                        ? result.text.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?/i)?.[0] ?? null
                        : null, date: result.date(),

                }));

            return {
                file: req.files[i].originalname,
                examDates: deduplicateExamDates(examDates),
            };
        });

        const allDates = syllabi.flatMap(s => s.examDates);

        if (allDates.length === 0) {
            return res.status(422).json({ error: 'No exam dates found in any syllabus.' });
        }

        const latest = new Date(Math.max(...allDates.map(e => e.date)));

        res.json({ syllabi, latest });

    } catch (err) {
        if (err.message === 'Invalid PDF file.') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Error parsing syllabi:', err);
        res.status(500).json({ error: 'Failed to parse dates from syllabi.' });
    }
};