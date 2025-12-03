// routes/admin.routes.js
const express = require("express");
const adminAuth = require("../middlewares/adminAuth");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const upload = require("../middlewares/upload");

const router = express.Router();

/* ========== DASHBOARD ========== */
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalUsers = await User.countDocuments({ role: "customer" });

    const stats = {
      totalOrders,
      totalProducts,
      totalUsers,
    };

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "fullName email")
      .lean();

    const lowStockProducts = await Product.find({
      "variants.stock": { $lte: 5 },
    })
      .limit(5)
      .lean();

    res.render("admin/dashboard", {
      layout: "admin/admin-layout",
      title: "Dashboard",
      user: req.session.user,
      stats,
      recentOrders,
      lowStockProducts,
    });
  } catch (err) {
    console.error("Lỗi load dashboard:", err);
    res.status(500).send("Lỗi server");
  }
});

/* ========== PROFILE ADMIN ========== */
router.get("/profile", adminAuth, async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const admin = await User.findById(adminId).lean();

    if (!admin) return res.status(404).send("Không tìm thấy admin");

    res.render("admin/profile", {
      layout: "admin/admin-layout",
      title: "Thông tin cá nhân",
      user: req.session.user,
      admin,
    });
  } catch (err) {
    console.error("Lỗi load profile admin:", err);
    res.status(500).send("Lỗi server");
  }
});

/* ========== QUẢN LÝ ĐƠN HÀNG ========== */
router.get("/orders", adminAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("user", "fullName email")
      .lean();

    res.render("admin/orders", {
      layout: "admin/admin-layout",
      title: "Quản lý đơn hàng",
      user: req.session.user,
      orders,
    });
  } catch (err) {
    console.error("Lỗi load orders:", err);
    res.status(500).send("Lỗi server");
  }
});

/* ========== QUẢN LÝ SẢN PHẨM ========== */

// Danh sách
router.get("/products", adminAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();

    const mapped = products.map((p) => {
      const totalStock = Array.isArray(p.variants)
        ? p.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : 0;

      const basePriceComputed =
        p.basePrice ||
        (Array.isArray(p.variants) && p.variants[0]
          ? p.variants[0].price || 0
          : 0);

      return {
        ...p,
        totalStock,
        basePriceComputed,
      };
    });

    res.render("admin/products", {
      layout: "admin/admin-layout",
      title: "Quản lý sản phẩm",
      user: req.session.user,
      products: mapped,
    });
  } catch (err) {
    console.error("Lỗi load products:", err);
    res.status(500).send("Lỗi tải danh sách sản phẩm");
  }
});

// Form thêm
router.get("/products/new", adminAuth, (req, res) => {
  res.render("admin/product-form", {
    layout: "admin/admin-layout",
    title: "Thêm sản phẩm",
    user: req.session.user,
    product: {},
    imagesText: "",
    firstVariant: null,
    isEdit: false,
  });
});

// Xử lý thêm
router.post(
  "/products",
  adminAuth,
  upload.fields([
    { name: "thumbnailFile", maxCount: 1 },
    { name: "imageFiles", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const body = req.body;
      const files = req.files || {};

      let thumbnail = null;
      if (files.thumbnailFile && files.thumbnailFile.length > 0) {
        thumbnail = "/uploads/" + files.thumbnailFile[0].filename;
      }

      let images = [];
      if (files.imageFiles && files.imageFiles.length > 0) {
        images = files.imageFiles.map((f) => "/uploads/" + f.filename);
      }

      const variants = [
        {
          name: body.variantName || "",
          sku: body.variantSku || "",
          price: Number(body.variantPrice) || 0,
          stock: Number(body.variantStock) || 0,
        },
      ];

      const basePriceValue =
        Number(body.basePrice) || (variants[0] ? variants[0].price : 0);

      await Product.create({
        name: body.name,
        brand: body.brand,
        category: body.category,
        thumbnail,
        images,
        basePrice: basePriceValue,
        variants,
        shortDescription: body.shortDescription,
        description: body.description,
        specs: {
          screen: body.screen,
          chip: body.chip,
          ram: body.ram,
          storage: body.storage,
          battery: body.battery,
        },
        isFeatured: !!body.isFeatured,
        isNew: !!body.isNew,
        isBestSeller: !!body.isBestSeller,
        isActive: body.isActive === "on",
      });

      res.redirect("/admin/products");
    } catch (err) {
      console.error("Lỗi tạo sản phẩm:", err);
      res.status(500).send("Lỗi tạo sản phẩm");
    }
  }
);

// Form sửa
router.get("/products/:id/edit", adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).send("Không tìm thấy sản phẩm");

    const imagesText = (product.images || []).join("\n");
    const firstVariant =
      Array.isArray(product.variants) && product.variants.length > 0
        ? product.variants[0]
        : null;

    res.render("admin/product-form", {
      layout: "admin/admin-layout",
      title: "Sửa sản phẩm",
      user: req.session.user,
      product,
      imagesText,
      firstVariant,
      isEdit: true,
    });
  } catch (err) {
    console.error("Lỗi tải form sửa sản phẩm:", err);
    res.status(500).send("Lỗi tải form sửa sản phẩm");
  }
});

// Xử lý cập nhật
router.post(
  "/products/:id/edit",
  adminAuth,
  upload.fields([
    { name: "thumbnailFile", maxCount: 1 },
    { name: "imageFiles", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const body = req.body;
      const files = req.files || {};

      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).send("Không tìm thấy sản phẩm");

      let thumbnail = product.thumbnail;
      if (files.thumbnailFile && files.thumbnailFile.length > 0) {
        thumbnail = "/uploads/" + files.thumbnailFile[0].filename;
      }

      let images = product.images || [];
      if (files.imageFiles && files.imageFiles.length > 0) {
        images = files.imageFiles.map((f) => "/uploads/" + f.filename);
      }

      const variants = [
        {
          name: body.variantName || "",
          sku: body.variantSku || "",
          price: Number(body.variantPrice) || 0,
          stock: Number(body.variantStock) || 0,
        },
      ];

      const basePriceValue =
        Number(body.basePrice) || (variants[0] ? variants[0].price : 0);

      await Product.findByIdAndUpdate(
        req.params.id,
        {
          name: body.name,
          brand: body.brand,
          category: body.category,
          thumbnail,
          images,
          basePrice: basePriceValue,
          variants,
          shortDescription: body.shortDescription,
          description: body.description,
          specs: {
            screen: body.screen,
            chip: body.chip,
            ram: body.ram,
            storage: body.storage,
            battery: body.battery,
          },
          isFeatured: !!body.isFeatured,
          isNew: !!body.isNew,
          isBestSeller: !!body.isBestSeller,
          isActive: body.isActive === "on",
        },
        { new: true }
      );

      res.redirect("/admin/products");
    } catch (err) {
      console.error("Lỗi cập nhật sản phẩm:", err);
      res.status(500).send("Lỗi cập nhật sản phẩm");
    }
  }
);

// Xóa
router.post("/products/:id/delete", adminAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Lỗi xóa sản phẩm:", err);
    res.status(500).send("Lỗi xóa sản phẩm");
  }
});

// Bật / tắt hiển thị
router.post("/products/:id/toggle-visibility", adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send("Không tìm thấy sản phẩm");

    product.isActive = !product.isActive;
    await product.save();

    res.redirect("/admin/products");
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái hiển thị:", err);
    res.status(500).send("Lỗi cập nhật trạng thái hiển thị");
  }
});
/* ========== QUẢN LÝ NGƯỜI DÙNG ========== */
router.get("/users", adminAuth, async (req, res) => {
  try {
    // Lấy tất cả user, sort mới nhất trước
    const users = await User.find().sort({ createdAt: -1 }).lean();

    res.render("admin/users", {
      layout: "admin/admin-layout",
      title: "Quản lý người dùng",
      user: req.session.user, // admin đang login
      users,
    });
  } catch (err) {
    console.error("Lỗi load users:", err);
    res.status(500).send("Lỗi tải danh sách người dùng");
  }
});

module.exports = router;
