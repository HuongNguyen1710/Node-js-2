const express = require("express");
const adminAuth = require("../middlewares/adminAuth"); // nếu chưa có thì tí nữa mình viết
const router = express.Router();

router.get("/dashboard", adminAuth, (req, res) => {
  // Tạm thời gửi dữ liệu giả, sau này nối DB sau
  const stats = {
    totalOrders: 128,
    todayRevenue: 32500000,
    newCustomers: 24,
    totalProducts: 87,
  };

  res.render("admin/dashboard", {
    user: req.session.user,      // để hiển thị tên
    stats,
    recentOrders: [],           // để trống, dashboard.ejs sẽ tự dùng dummy
    lowStockProducts: [],       // để trống, dashboard.ejs sẽ tự dùng dummy
  });
});

module.exports = router;
