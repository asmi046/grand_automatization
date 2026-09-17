const express = require('express');
const { Op } = require('sequelize');
const { Check, Event, Session, Case } = require('../../db');

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
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await Check.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [['startedAt', 'DESC']],
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

router.get('/:checkId', async (req, res, next) => {
  try {
    const check = await Check.findByPk(req.params.checkId);
    if (!check) return res.status(404).json({ error: 'Not found' });
    res.json(check);
  } catch (err) {
    next(err);
  }
});

router.get('/:checkId/sessions', async (req, res, next) => {
  try {
    const page = intParam(req.query.page, 1);
    const size = Math.min(intParam(req.query.size, 30), 100);
    const offset = (page - 1) * size;

    const { count, rows } = await Session.findAndCountAll({
      where: { checkId: req.params.checkId },
      include: [{ model: Case, attributes: ['caseNumber', 'courtName', 'status'] }],
      limit: size,
      offset,
      order: [['date', 'ASC']],
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

router.get('/:checkId/events', async (req, res, next) => {
  try {
    const page = intParam(req.query.page, 1);
    const size = Math.min(intParam(req.query.size, 30), 100);
    const offset = (page - 1) * size;

    const { count, rows } = await Event.findAndCountAll({
      where: { checkId: req.params.checkId },
      limit: size,
      offset,
      order: [['id', 'ASC']],
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
