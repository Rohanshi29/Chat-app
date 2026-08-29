const User = require("../models/User");

// @route  PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { username, bio } = req.body;

    if (username) req.user.username = username;
    if (bio !== undefined) req.user.bio = bio;

    if (req.file) {
      req.user.profilePicture = `/uploads/${req.file.filename}`;
    }

    await req.user.save();
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/users
// Get all users except the current one, for starting new chats
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      "username email profilePicture bio isOnline lastSeen"
    );
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "username email profilePicture bio isOnline lastSeen"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  POST /api/users/push-subscribe
const subscribePush = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ message: "subscription is required" });

    req.user.pushSubscription = subscription;
    await req.user.save();
    res.json({ message: "Subscribed to push notifications" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route  DELETE /api/users/push-subscribe
const unsubscribePush = async (req, res) => {
  try {
    req.user.pushSubscription = null;
    await req.user.save();
    res.json({ message: "Unsubscribed from push notifications" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updateProfile,
  getAllUsers,
  getUserById,
  subscribePush,
  unsubscribePush,
};
