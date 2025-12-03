// middlewares/adminAuth.js
module.exports = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/auth/login"); // login đúng prefix /auth
  }
  next();
};
