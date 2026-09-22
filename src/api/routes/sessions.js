const express = require('express');
const { Op } = require('sequelize');
const { Session, Case } = require('../../db');

const router = express.Router();

function intParam(value, def) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

router.get('/', async (req, res, next) => {
  try {
    const page = intParam(req.query.page, 1);
    const size = Math.min(intParam(req.query.size, 30), 100);
    const offset = (page - 1) * size;

    const where = {};
    if (req.query.caseId) where.caseId = req.query.caseId;
    if (req.query.sessionId) where.sessionId = req.query.sessionId;
    if (req.query.court) where.court = { [Op.like]: `%${req.query.court}%` };
    if (req.query.judge) where.judge = { [Op.like]: `%${req.query.judge}%` };

    const dateRange = {};
    if (req.query.dateFrom) dateRange[Op.gte] = new Date(req.query.dateFrom);
    if (req.query.dateTo) dateRange[Op.lte] = new Date(req.query.dateTo);
    if (Object.keys(dateRange).length) where.date = dateRange;

    const order = req.query.order === 'desc' ? [['date', 'DESC']] : [['date', 'ASC']];

    const include = [
      {
        model: Case,
        attributes: ['caseId', 'caseNumber', 'courtName', 'status'],
        required: !!req.query.caseNumber,
      },
    ];
    if (req.query.caseNumber) {
      include[0].where = { caseNumber: { [Op.like]: `%${req.query.caseNumber}%` } };
    }

    const { count, rows } = await Session.findAndCountAll({
      where,
      include,
      limit: size,
      offset,
      order,
    });

    res.json({
      items: rows,
      total: count,
      page,
      size,
      pages: Math.ceil(count / size) || 1,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/upcoming', async (req, res, next) => {
  try {
    const size = Math.min(intParam(req.query.size, 50), 200);

    const where = { date: { [Op.gte]: new Date() } };
    const include = [{ model: Case, attributes: ['caseId', 'caseNumber', 'courtName', 'status'] }];
    if (req.query.caseId) where.caseId = req.query.caseId;
    if (req.query.court) where.court = { [Op.like]: `%${req.query.court}%` };
    if (req.query.judge) where.judge = { [Op.like]: `%${req.query.judge}%` };
    if (req.query.caseNumber) {
      include[0].required = true;
      include[0].where = { caseNumber: { [Op.like]: `%${req.query.caseNumber}%` } };
    }

    const rows = await Session.findAll({ where, include, order: [['date', 'ASC']], limit: size });
    res.json({ items: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
