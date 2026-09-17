const express = require('express');
const { Op } = require('sequelize');
const { Event } = require('../../db');

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
    if (req.query.eventType) where.eventType = { [Op.like]: `%${req.query.eventType}%` };
    if (req.query.caseId) where.caseId = req.query.caseId;
    if (req.query.sessionId) where.sessionId = req.query.sessionId;
    if (req.query.caseNumber) where.caseNumber = { [Op.like]: `%${req.query.caseNumber}%` };

    const dateRange = {};
    if (req.query.dateFrom) dateRange[Op.gte] = new Date(req.query.dateFrom);
    if (req.query.dateTo) dateRange[Op.lte] = new Date(req.query.dateTo);
    if (Object.keys(dateRange).length) where.createdAt = dateRange;

    const { count, rows } = await Event.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [['id', 'DESC']],
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

module.exports = router;
