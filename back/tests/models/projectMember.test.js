const { sequelize, User, Project, ProjectMember } = require('../../src/models');

describe('ProjectMember model', () => {
  let project;
  let developer;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    project = await Project.create({ name: 'Website Revamp' });
    developer = await User.create({
      name: 'Dev One',
      email: 'dev1@example.com',
      passwordHash: 'hashed',
      role: 'developer',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('links a user to a project as a member', async () => {
    const row = await ProjectMember.create({ projectId: project.id, userId: developer.id });
    expect(row.projectId).toBe(project.id);
    expect(row.userId).toBe(developer.id);
    const withMembers = await Project.findByPk(project.id, { include: ['members'] });
    expect(withMembers.members.map((u) => u.email)).toEqual(['dev1@example.com']);
  });

  it('rejects a duplicate member on the same project', async () => {
    await expect(
      ProjectMember.create({ projectId: project.id, userId: developer.id })
    ).rejects.toThrow();
  });
});
