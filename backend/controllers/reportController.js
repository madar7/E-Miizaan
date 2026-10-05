const { success, fail } = require("../utils/response");
const asyncHandler = require("../utils/asyncHandler");
const reportService = require("../services/reportService");

function parseParams(query) {
  const preset = reportService.VALID_PRESETS.includes(query.range) ? query.range : "custom";
  return { preset, refDate: query.date, startDate: query.startDate, endDate: query.endDate };
}

// GET /api/reports?range=daily|weekly|monthly|yearly|custom&date=&startDate=&endDate=
const getReport = asyncHandler(async (req, res) => {
  const params = parseParams(req.query);
  if (params.preset === "custom" && !params.startDate && !params.endDate) {
    return fail(res, { status: 400, message: "Provide a range preset (daily/weekly/monthly/yearly) or a startDate/endDate" });
  }
  const report = await reportService.buildReport(req.user._id, params);
  return success(res, { message: "Report generated", data: report });
});

// GET /api/reports/export?...&format=csv
const exportReport = asyncHandler(async (req, res) => {
  const params = parseParams(req.query);
  const transactions = await reportService.listForExport(req.user._id, params);
  const csv = reportService.toCSV(transactions);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="e-miizaan-report-${params.preset}.csv"`);
  res.send(csv);
});

module.exports = { getReport, exportReport };
