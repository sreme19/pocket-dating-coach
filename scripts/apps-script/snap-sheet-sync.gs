/**
 * Snap lead sheet -> Riteangle sync (Google Apps Script)
 * =====================================================
 *
 * Runs INSIDE the Google Sheet that Snap's "Direct integration" writes leads to
 * (one sheet per lead form). A time-driven trigger calls syncSnapLeads() every
 * ~30 minutes; it reads rows the sheet has gained since the last run and POSTs
 * them to /api/marketing/snap-sheet-sync on riteangle.dating, which upserts them
 * into marketing_leads.
 *
 * WHY THIS LIVES HERE (in the sheet, not our repo runtime): Snap's lead delivery
 * only writes to the sheet — there is no webhook that fires and no Marketing API
 * endpoint that lists submissions (see rules/lead-delivery.md). Apps Script is
 * the free, plan-independent way to get the sheet to push to us. This .gs is the
 * tracked copy; the running copy is pasted into the sheet's Apps Script editor.
 *
 * IDEMPOTENT BY DESIGN. The server dedupes on lead id / phone / email, so it is
 * safe to re-send a row. This script tracks the last row it sent only to avoid
 * re-POSTing the whole sheet each run; correctness does not depend on the pointer
 * being exact, and on any non-200 it does NOT advance, so a failed batch is
 * retried on the next sweep.
 *
 * ------------------------------------------------------------------------------
 * ONE-TIME SETUP
 * ------------------------------------------------------------------------------
 * 1. Open the lead sheet -> Extensions -> Apps Script. Paste this whole file.
 * 2. Project Settings -> Script properties, add two:
 *      ENDPOINT_URL  = https://www.riteangle.dating/api/marketing/snap-sheet-sync
 *      SYNC_SECRET   = <the same value set as SNAP_SHEET_SYNC_SECRET in Vercel>
 *    (Never hard-code the secret in the script body — script properties keep it
 *     out of this source and out of anyone's view of the code.)
 * 3. Run installTrigger() once from the editor and grant the permission prompt.
 *    That creates the 30-minute time-driven trigger. Do this instead of adding a
 *    trigger by hand so the interval and handler are version-controlled here.
 * 4. Run syncSnapLeads() once manually to backfill and confirm it works; check
 *    the execution log for the server's summary line.
 *
 * If a header name in the sheet ever differs from the constants in COLUMN_MAP
 * below, update the map — matching is by header text, not column position, so
 * column reordering in the sheet is already tolerated.
 */

/** Header text -> the field name the endpoint expects. Matching is case- and
 *  whitespace-insensitive (see headerKey). Add aliases freely. */
var COLUMN_MAP = {
	formid: 'formId',
	formname: 'formName',
	campaignid: 'campaignId',
	campaignname: 'campaignName',
	adid: 'adId',
	adname: 'adName',
	adsquadid: 'adSquadId',
	adsquadname: 'adSquadName',
	leadid: 'leadId',
	createtime: 'createTime',
	firstname: 'firstName',
	lastname: 'lastName',
	email: 'email',
	phonenumber: 'phoneNumber',
	leadstatus: 'leadStatus'
};

var LAST_ROW_PROP = 'lastSyncedRow';
var BATCH_LIMIT = 500; // rows per POST; the endpoint caps the body at 512 KB.

function headerKey(h) {
	return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function installTrigger() {
	// Remove any existing triggers for this handler so re-running does not stack
	// duplicates, then create a single 30-minute one.
	var existing = ScriptApp.getProjectTriggers();
	for (var i = 0; i < existing.length; i++) {
		if (existing[i].getHandlerFunction() === 'syncSnapLeads') {
			ScriptApp.deleteTrigger(existing[i]);
		}
	}
	ScriptApp.newTrigger('syncSnapLeads').timeBased().everyMinutes(30).create();
	Logger.log('Installed 30-minute trigger for syncSnapLeads.');
}

function syncSnapLeads() {
	var props = PropertiesService.getScriptProperties();
	var endpoint = props.getProperty('ENDPOINT_URL');
	var secret = props.getProperty('SYNC_SECRET');
	if (!endpoint || !secret) {
		throw new Error('Set ENDPOINT_URL and SYNC_SECRET in Script properties first.');
	}

	var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
	var lastRow = sheet.getLastRow();
	var lastCol = sheet.getLastColumn();
	if (lastRow < 2) {
		Logger.log('No data rows yet.');
		return;
	}

	// Build a header index once so we can emit fields by name.
	var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
	var fieldByCol = headers.map(function (h) {
		return COLUMN_MAP[headerKey(h)] || null;
	});

	var startRow = Math.max(2, Number(props.getProperty(LAST_ROW_PROP) || 1) + 1);
	if (startRow > lastRow) {
		Logger.log('Nothing new since row ' + (startRow - 1) + '.');
		return;
	}

	var count = lastRow - startRow + 1;
	var values = sheet.getRange(startRow, 1, count, lastCol).getValues();

	// Chunk so no single POST exceeds the endpoint's body cap.
	var sentUpTo = startRow - 1;
	for (var offset = 0; offset < values.length; offset += BATCH_LIMIT) {
		var slice = values.slice(offset, offset + BATCH_LIMIT);
		var rows = slice.map(function (rowVals) {
			var obj = {};
			for (var c = 0; c < fieldByCol.length; c++) {
				var field = fieldByCol[c];
				if (!field) continue;
				var v = rowVals[c];
				if (v instanceof Date) v = v.toISOString();
				obj[field] = v == null ? '' : String(v);
			}
			return obj;
		});

		var res = UrlFetchApp.fetch(endpoint, {
			method: 'post',
			contentType: 'application/json',
			headers: { 'x-sync-secret': secret },
			muteHttpExceptions: true,
			payload: JSON.stringify({ rows: rows })
		});

		var code = res.getResponseCode();
		var text = res.getContentText();
		Logger.log('POST ' + rows.length + ' rows -> ' + code + ' ' + text);

		if (code !== 200) {
			// Do NOT advance the pointer: leave this batch (and everything after it)
			// for the next sweep. Idempotency on the server makes the retry safe.
			Logger.log('Non-200; leaving pointer at row ' + sentUpTo + ' for retry.');
			return;
		}
		sentUpTo = startRow - 1 + offset + slice.length;
		props.setProperty(LAST_ROW_PROP, String(sentUpTo));
	}

	Logger.log('Sync complete. Pointer at row ' + sentUpTo + '.');
}

/**
 * Reset the sync pointer so the next run re-sends the whole sheet. Safe to run
 * any time (the server dedupes); use it after fixing a mapping or to force a
 * full backfill.
 */
function resetSyncPointer() {
	PropertiesService.getScriptProperties().deleteProperty(LAST_ROW_PROP);
	Logger.log('Pointer reset; next run re-sends all rows.');
}
