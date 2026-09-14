const { sequelize, User, Project, ProjectMember } = require('../../src/models');
const { isProjectMember, memberProjectIds } = require('../../src/utils/projectAccess');

describe('projectAccess', () => {
  let project;
  let other;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'A' });
    other = await Project.create({ name: 'B' });
    developer = await User.create({
      name: 'Dev',
      email: 'dev@example.com',
      passwordHash: 'x',
      role: 'developer',
    });
    await ProjectMember.create({ projectId: project.id, userId: developer.id });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('isProjectMember is true only for the joined project', async () => {
    expect(await isProjectMember(developer.id, project.id)).toBe(true);
    expect(await isProjectMember(developer.id, other.id)).toBe(false);
  });

  it('memberProjectIds returns only joined projects', async () => {
    expect(await memberProjectIds(developer.id)).toEqual([project.id]);
  });
});
