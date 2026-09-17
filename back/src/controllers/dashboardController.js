async function list(req, res) {
  return res.json({
    pulse: { overdue: 0, today: 0, remindersToday: 0, paused: 0 },
    items: [],
  });
}

module.exports = { list };
