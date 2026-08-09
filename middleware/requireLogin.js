export function requireLogin(req, res, next) {
  if (!req.user) {
    res.status(401).json({
      error: "Login required."
    });

    return;
  }

  next();
}