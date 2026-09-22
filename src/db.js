const { Sequelize, DataTypes } = require('sequelize');
const config = require('./config');

const sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  logging: false,
  pool: config.db.pool,
});

const Case = sequelize.define(
  'Case',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    caseId: { type: DataTypes.STRING(36), allowNull: false, unique: true },
    caseNumber: { type: DataTypes.STRING(64), allowNull: true },
    courtName: { type: DataTypes.STRING(255), allowNull: true },
    judgeName: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.STRING(255), allowNull: true },
    caseTypeName: { type: DataTypes.STRING(255), allowNull: true },
    caseTypeCode: { type: DataTypes.STRING(32), allowNull: true },
    isMonitored: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
    claimSum: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    versionDateUtc: { type: DataTypes.DATE, allowNull: true },
    groupName: { type: DataTypes.STRING(255), allowNull: true },
    folderId: { type: DataTypes.INTEGER, allowNull: true },
    checkId: {
      type: DataTypes.STRING(36),
      allowNull: true,
      references: { model: 'checks', key: 'checkId' },
    },
  },
  {
    tableName: 'cases',
    timestamps: true,
    indexes: [
      { fields: ['caseNumber'] },
      { fields: ['groupName', 'folderId'] },
      { fields: ['checkId'] },
    ],
  },
);

const Check = sequelize.define(
  'Check',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    checkId: { type: DataTypes.STRING(36), allowNull: false, unique: true },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('running', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'running',
    },
    result: { type: DataTypes.JSON, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'checks',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['startedAt'] },
    ],
  },
);

const Session = sequelize.define(
  'Session',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sessionId: { type: DataTypes.STRING(36), allowNull: false, unique: true },
    caseId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: { model: 'cases', key: 'caseId' },
    },
    checkId: {
      type: DataTypes.STRING(36),
      allowNull: true,
      references: { model: 'checks', key: 'checkId' },
    },
    date: { type: DataTypes.DATE, allowNull: false },
    court: { type: DataTypes.STRING(255), allowNull: true },
    judge: { type: DataTypes.STRING(255), allowNull: true },
    judgeId: { type: DataTypes.STRING(36), allowNull: true },
    instanceLevel: { type: DataTypes.INTEGER, allowNull: true },
    instanceNumber: { type: DataTypes.STRING(64), allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: true },
    documentId: { type: DataTypes.STRING(36), allowNull: true },
    courtTag: { type: DataTypes.STRING(32), allowNull: true },
    iWillGo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isAutoChecked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    autoCheckedTime: { type: DataTypes.DATE, allowNull: true },
    loadToLiderTask: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    rawEvent: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'sessions',
    timestamps: true,
    indexes: [
      { fields: ['caseId'] },
      { fields: ['date'] },
      { fields: ['checkId'] },
    ],
  },
);

Case.hasMany(Session, { foreignKey: 'caseId', sourceKey: 'caseId' });
Session.belongsTo(Case, { foreignKey: 'caseId', targetKey: 'caseId' });

const EVENT_TYPES = Object.freeze({
  SCAN_SESSION_START: 'scan.session.start',
  CASE_ADDED: 'case.added',
  SESSION_ADDED: 'session.added',
  SESSION_IWILLGO_AUTO_SET: 'session.iwillgo.auto_set',
});

const Event = sequelize.define(
  'Event',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    eventType: { type: DataTypes.STRING(64), allowNull: false },
    caseId: { type: DataTypes.STRING(36), allowNull: true },
    caseNumber: { type: DataTypes.STRING(64), allowNull: true },
    sessionId: { type: DataTypes.STRING(36), allowNull: true },
    checkId: {
      type: DataTypes.STRING(36),
      allowNull: true,
      references: { model: 'checks', key: 'checkId' },
    },
    payload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['eventType'] },
      { fields: ['caseId'] },
      { fields: ['sessionId'] },
      { fields: ['checkId'] },
      { fields: ['createdAt'] },
    ],
  },
);

Check.hasMany(Event, { foreignKey: 'checkId', sourceKey: 'checkId' });
Event.belongsTo(Check, { foreignKey: 'checkId', targetKey: 'checkId' });
Check.hasMany(Session, { foreignKey: 'checkId', sourceKey: 'checkId' });
Session.belongsTo(Check, { foreignKey: 'checkId', targetKey: 'checkId' });
Case.hasMany(Event, { foreignKey: 'caseId', sourceKey: 'caseId' });
Event.belongsTo(Case, { foreignKey: 'caseId', targetKey: 'caseId' });

async function logEvent({ eventType, caseId, caseNumber, sessionId, checkId, payload }) {
  return Event.create({
    eventType,
    caseId: caseId ?? null,
    caseNumber: caseNumber ?? null,
    sessionId: sessionId ?? null,
    checkId: checkId ?? null,
    payload: payload ?? null,
  });
}

async function clearDatabase() {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await Event.destroy({ where: {}, truncate: true, restartIdentity: true });
    await Session.destroy({ where: {}, truncate: true, restartIdentity: true });
    await Case.destroy({ where: {}, truncate: true, restartIdentity: true });
    await Check.destroy({ where: {}, truncate: true, restartIdentity: true });
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

async function initSchema() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: config.db.syncAlter });
}

module.exports = {
  sequelize,
  Case,
  Session,
  Event,
  Check,
  EVENT_TYPES,
  logEvent,
  initSchema,
  clearDatabase,
};
