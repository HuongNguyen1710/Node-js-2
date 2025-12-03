// routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Order = require("../models/Order");

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/auth/login");
  }
  next();
}

// ================== ĐĂNG KÝ ==================
router.get("/register", (req, res) => {
  res.render("auth/register");
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, line1, city, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing && !existing.isGuest) {
      return res.send("Email đã tồn tại");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    if (existing && existing.isGuest) {
      // chuyển guest thành user chính thức
      existing.passwordHash = passwordHash;
      existing.fullName = fullName;
      existing.defaultAddress = {
        fullName,
        line1,
        city,
        phone,
        isDefault: true
      };
      existing.isGuest = false;
      existing.provider = "local";
      user = await existing.save();
    } else {
      user = await User.create({
        email,
        passwordHash,
        fullName,
        defaultAddress: { fullName, line1, city, phone, isDefault: true },
        provider: "local",
        isGuest: false
      });
    }

    req.session.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      role: user.role
    };

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi server");
  }
});

// ================== ĐĂNG NHẬP / ĐĂNG XUẤT ==================
router.get("/login", (req, res) => {
  res.render("auth/login");
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.send("Sai email hoặc mật khẩu");
    }

    const ok = await user.checkPassword(password);
    if (!ok) {
      return res.send("Sai email hoặc mật khẩu");
    }

    req.session.user = {
      id: user._id.toString(),
      fullName: user.fullName,
      role: user.role
    };

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi server");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// ================== HỒ SƠ / TÀI KHOẢN ==================

// GET /auth/profile – hiển thị thông tin + đơn hàng
router.get("/profile", requireLogin, async (req, res) => {
  try {
    // user trong session chỉ để lấy id
    const sessionUser = req.session.user;

    // Lấy user đầy đủ từ MongoDB (có email, defaultAddress,...)
    const dbUser = await User.findById(sessionUser.id).lean();

    // Lấy tất cả đơn hàng của user
    const orders = await Order.find({ user: dbUser._id })
      .sort({ createdAt: -1 })
      .lean();

    const ordersByStatus = {
      pending: [],
      processing: [],
      completed: [],
      cancelled: []
    };

    orders.forEach((o) => {
      if (ordersByStatus[o.status]) {
        ordersByStatus[o.status].push(o);
      }
    });

    res.render("auth/profile", {
      user: dbUser,
      ordersByStatus
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin tài khoản:", err);
    res.status(500).send("Có lỗi khi tải trang tài khoản.");
  }
});

// POST /auth/profile/update – lưu thông tin cá nhân
router.post("/profile/update", requireLogin, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { fullName, phone, line1, ward, district, city } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("Không tìm thấy user.");
    }

    // Cập nhật tên
    if (fullName && fullName.trim()) {
      user.fullName = fullName.trim();
    }

    // Đảm bảo luôn có defaultAddress
    if (!user.defaultAddress) {
      user.defaultAddress = {};
    }

    user.defaultAddress.fullName = user.fullName;
    user.defaultAddress.phone = phone || "";
    user.defaultAddress.line1 = line1 || "";
    user.defaultAddress.ward = ward || "";
    user.defaultAddress.district = district || "";
    user.defaultAddress.city = city || "";
    user.defaultAddress.isDefault = true;

    await user.save();

    // Cập nhật lại tên trong session để header hiển thị đúng
    req.session.user.fullName = user.fullName;

    res.redirect("/auth/profile");
  } catch (err) {
    console.error("Lỗi cập nhật thông tin:", err);
    res.status(500).send("Có lỗi khi cập nhật thông tin.");
  }
});

module.exports = router;
