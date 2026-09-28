/**
 * Google Apps Script backend for the "Sheets Backend" tool (Task 5).
 *
 * Setup:
 *   1. Create a Google Sheet with headers in row 1: Name | Score | Timestamp
 *   2. Extensions > Apps Script, paste this file, save.
 *   3. Deploy > New deployment > Web app
 *        Execute as: Me    Who has access: Anyone
 *   4. Copy the /exec URL into the app's "Apps Script Web App URL" field.
 *
 * GET  -> returns all rows as JSON: [{"name": "...", "score": ...}, ...]
 * POST -> body {"name": "...", "score": "..."} (sent as text/plain) appends a row,
 *         returns {"status": "ok"} or {"status": "error", "message": "..."}
 */

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const values = getSheet_().getDataRange().getValues();
  const rows = values.slice(1) // skip header row
    .filter(r => r[0] !== '')
    .map(r => ({ name: r[0], score: r[1] }));
  return jsonOut_(rows);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const name = String(body.name || '').trim();
    const score = String(body.score ?? '').trim();
    if (!name || !score) {
      return jsonOut_({ status: 'error', message: 'name and score are required' });
    }
    getSheet_().appendRow([name, score, new Date()]);
    return jsonOut_({ status: 'ok' });
  } catch (err) {
    return jsonOut_({ status: 'error', message: String(err) });
  }
}
