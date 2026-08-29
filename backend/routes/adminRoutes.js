const express = require("express");
const {
  listUsers,
  banUser,
  unbanUser,
  deleteUser,
  getStats,
} = require("../controllers/adminController");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/users", listUsers);
router.put("/users/:id/ban", banUser);
router.put("/users/:id/unban", unbanUser);
router.delete("/users/:id", deleteUser);
router.get("/stats", getStats);

module.exports = router;
