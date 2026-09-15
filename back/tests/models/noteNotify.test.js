const { sequelize, User, Note, NoteNotify, Feature, FeatureNotify, Project } = require('../../src/models');

describe('notify join tables', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('stores extra notify users on a note and a feature', async () => {
    const owner = await User.create({
      name: 'Owner',
      email: 'owner@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const extra = await User.create({
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    const note = await Note.create({
      userId: owner.id,
      title: 'Ping',
      content: 'x',
      isReminder: true,
      remindAt: new Date(),
    });
    await NoteNotify.create({ noteId: note.id, userId: extra.id });
    const withUsers = await Note.findByPk(note.id, {
      include: { model: User, as: 'notifyUsers' },
    });
    expect(withUsers.notifyUsers.map((u) => u.id)).toEqual([extra.id]);

    const project = await Project.create({ name: 'Website Revamp' });
    const feature = await Feature.create({
      projectId: project.id,
      userId: owner.id,
      title: 'SSO',
      isReminder: true,
      remindAt: new Date(),
    });
    await FeatureNotify.create({ featureId: feature.id, userId: extra.id });
    const featureWithUsers = await Feature.findByPk(feature.id, {
      include: { model: User, as: 'notifyUsers' },
    });
    expect(featureWithUsers.notifyUsers.map((u) => u.id)).toEqual([extra.id]);
  });
});
