const User = require("../models/User");
const Message = require("../models/Message");
const Chat = require("../models/Chat");

// @route  GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/admin/users/:id/ban
const banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot ban an admin" });
    }
    user.isBanned = true;
    await user.save();
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  PUT /api/admin/users/:id/unban
const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: false },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      return res.status(400).json({ message: "Cannot delete an admin" });
    }
    await user.deleteOne();
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, bannedUsers, totalMessages, messagesToday, totalChats, groupChats] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isOnline: true }),
        User.countDocuments({ isBanned: true }),
        Message.countDocuments(),
        Message.countDocuments({ createdAt: { $gte: startOfToday } }),
        Chat.countDocuments(),
        Chat.countDocuments({ isGroupChat: true }),
      ]);

    // Messages sent per day for the last 7 days, for a simple trend chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyAgg = await Message.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalUsers,
      activeUsers,
      bannedUsers,
      totalMessages,
      messagesToday,
      totalChats,
      groupChats,
      dailyMessages: dailyAgg.map((d) => ({ date: d._id, count: d.count })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { listUsers, banUser, unbanUser, deleteUser, getStats };
