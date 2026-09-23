const express = require('express');
const { Op } = require('sequelize');
const { Case } = require('../../db');

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
    if (req.query.caseNumber) where.caseNumber = { [Op.like]: `%${req.query.caseNumber}%` };
    if (req.query.status) where.status = { [Op.like]: `%${req.query.status}%` };
    if (req.query.courtName) where.courtName = { [Op.like]: `%${req.query.courtName}%` };
    if (req.query.judgeName) where.judgeName = { [Op.like]: `%${req.query.judgeName}%` };
    if (req.query.groupName) where.groupName = { [Op.like]: `%${req.query.groupName}%` };
    if (req.query.isMonitored === 'true') where.isMonitored = true;
    if (req.query.isMonitored === 'false') where.isMonitored = false;

    const { count, rows } = await Case.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [['versionDateUtc', 'DESC']],
      attributes: { exclude: ['caseSides'] },
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

router.get('/:caseId', async (req, res, next) => {
  try {
    const row = await Case.findOne({
      where: { caseId: req.params.caseId },
    });
    if (!row) return res.status(404).json({ error: 'Case not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
