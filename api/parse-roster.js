// api/parse-roster.js
// Replaces the old Tesseract pipeline. The client already knows exactly
// which employee it's looking for (the name typed/selected in Settings >
// My Profile), so this endpoint's only job is: find that person's row on
// the roster screenshot and read their shift for every visible day.
//
// No Supabase lookup needed here — unlike an earlier draft of this file,
// there's no "import everyone" admin flow in this app. Each user uploads
// their own roster photo and pulls out just their own row.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mediaType, employeeName, referenceYear } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ error: 'Missing employeeName — set your name in Settings first.' });
    }

    const year = Number(referenceYear) || new Date().getFullYear();

    const prompt = `You are reading a duty roster screenshot (a spreadsheet-style table).
The left-most column holds employee names (format may be "SURNAME, Firstname" or similar).
Column headers across the top are dates (e.g. "21 Sept", "22 Sept" — may or may not include a year).

Find the row for this employee (match even if punctuation, spacing, or
name order differs slightly): "${employeeName}"

If no row is a confident match, respond with exactly:
{"found": false}

If you find a confident match, respond with ONLY this JSON shape, no prose,
no markdown fences:

{
  "found": true,
  "matchedName": "<exact name as printed on the roster>",
  "days": [
    { "date": "YYYY-MM-DD", "text": "<exact cell text, e.g. '0500-1000', 'RDO', 'ALLV'>" }
  ]
}

Rules:
- Include one entry in "days" for every date column visible in the table, in left-to-right order.
- For "date", convert the printed header (e.g. "21 Sept") to full ISO format. If no year is printed in the image, assume ${year}.
- For "text", copy the cell exactly as printed — do not reformat, guess, or invent a value. If a cell is genuinely blank or unreadable, use an empty string "".
- Read digits carefully — shift times are the most safety-critical data in this app. Double-check any digit you're not fully confident about rather than guessing.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imageBase64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const rawText = data.content?.map((b) => b.text || '').join('') || '{"found":false}';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse model output:', cleaned);
      return res.status(502).json({ error: 'Could not read that roster photo clearly. Try a clearer, well-lit photo.' });
    }

    if (!parsed.found) {
      return res.status(200).json({ found: false });
    }

    // Basic shape validation so a malformed model response can't corrupt
    // the client's review screen.
    if (!Array.isArray(parsed.days) || !parsed.matchedName) {
      return res.status(502).json({ error: 'Unexpected response reading the roster. Try again.' });
    }

    return res.status(200).json({
      found: true,
      matchedName: parsed.matchedName,
      days: parsed.days.map((d) => ({
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
        text: String(d.text || '').trim(),
      })).filter((d) => d.date), // drop any day whose date couldn't be parsed
    });
  } catch (err) {
    console.error('Roster parse error:', err);
    return res.status(500).json({ error: 'Failed to parse roster image' });
  }
}
