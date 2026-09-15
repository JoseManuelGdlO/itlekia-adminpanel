const { sequelize, User, Project, ProjectMember } = require('../../src/models');
const { resolveNotifyUserIds } = require('../../src/utils/notifyRecipients');

describe('resolveNotifyUserIds', () => {
  let owner;
  let member;
  let outsider;
  let project;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    owner = await User.create({ name: 'Owner', email: 'o@example.com', passwordHash: 'x', role: 'developer' });
    member = await User.create({ name: 'Ada', email: 'ada@example.com', passwordHash: 'x', role: 'developer' });
    outsider = await User.create({ name: 'Out', email: 'out@example.com', passwordHash: 'x', role: 'developer' });
    project = await Project.create({ name: 'Website Revamp' });
    await ProjectMember.create({ projectId: project.id, userId: member.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('returns unique extras and drops the actor', async () => {
    const ids = await resolveNotifyUserIds([member.id, owner.id, member.id], {
      projectId: project.id,
      actorId: owner.id,
    });
    expect(ids).toEqual([member.id]);
  });

  it('rejects a non-member when project-scoped', async () => {
    await expect(
      resolveNotifyUserIds([outsider.id], { projectId: project.id, actorId: owner.id })
    ).rejects.toThrow('Invalid recipient');
  });

  it('allows any existing user when standalone', async () => {
    const ids = await resolveNotifyUserIds([outsider.id], { projectId: null, actorId: owner.id });
    expect(ids).toEqual([outsider.id]);
  });
});
